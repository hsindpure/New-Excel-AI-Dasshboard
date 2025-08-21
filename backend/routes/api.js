// backend/routes/api.js - Enhanced for large dataset performance
const express = require('express');
const router = express.Router();

// Import services
let upload, dataProcessor, aiService, calculator;

try {
  upload = require('../middleware/upload');
  dataProcessor = require('../services/dataProcessor');
  aiService = require('../services/aiService');
  calculator = require('../services/calculator');
  console.log('✅ All services loaded successfully');
} catch (error) {
  console.log('⚠️ Some services not found, using basic routes only');
}

// Store sessions in memory (use Redis in production)
const sessions = new Map();

// Middleware to clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [sessionId, sessionData] of sessions.entries()) {
    if (now - new Date(sessionData.uploadTime).getTime() > maxAge) {
      sessions.delete(sessionId);
      console.log(`🗑️ Cleaned up expired session: ${sessionId}`);
    }
  }
  
  // Also clear calculator cache to prevent memory leaks
  if (calculator) {
    calculator.clearCache();
  }
}, 60 * 60 * 1000); // Clean up every hour

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working perfectly!',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /api/test',
      'POST /api/upload',
      'GET /api/session/:sessionId',
      'POST /api/generate-dashboard',
      'GET /api/data-limit-options'
    ]
  });
});

// Get data limit options for large datasets
router.get('/data-limit-options', (req, res) => {
  try {
    const options = calculator ? calculator.getDataLimitOptions() : [
      { label: 'Top 50 Records', value: 50 },
      { label: 'Top 100 Records', value: 100 },
      { label: 'Top 1,000 Records', value: 1000 },
      { label: 'All Data', value: null }
    ];

    res.json({
      success: true,
      options
    });
  } catch (error) {
    console.error('❌ Data limit options error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting data limit options'
    });
  }
});

// File upload and initial processing
if (upload && dataProcessor) {
  router.post('/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      console.log('📁 Processing uploaded file:', req.file.originalname);

      // Process the file with optimizations
      const result = await dataProcessor.processFile(req.file);
      
      // Create session
      const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // Store in session with performance metadata
      sessions.set(sessionId, {
        ...result,
        fileName: req.file.originalname,
        uploadTime: new Date().toISOString(),
        performance: {
          isLargeDataset: result.stats.isLargeDataset,
          recommendedDataLimit: result.stats.isLargeDataset ? 1000 : null
        }
      });

      console.log(`✅ File processed successfully. Session ID: ${sessionId}, Rows: ${result.stats.totalRows}`);

      res.json({
        success: true,
        sessionId,
        message: 'File processed successfully',
        preview: {
          fileName: req.file.originalname,
          rowCount: result.fullDataCount || result.data.length,
          columns: result.schema.columns.length,
          schema: result.schema,
          isLargeDataset: result.stats.isLargeDataset,
          recommendedDataLimit: result.stats.isLargeDataset ? 1000 : null
        }
      });

    } catch (error) {
      console.error('❌ Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing file: ' + error.message
      });
    }
  });
} else {
  router.post('/upload', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Upload service not available. Please check if all files are properly set up.'
    });
  });
}

// Get session data
router.get('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionData = sessions.get(sessionId);

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Don't send full data in session response for performance
    const responseData = {
      ...sessionData,
      data: undefined, // Remove full data
      dataPreview: sessionData.data.slice(0, 10), // Send small preview
      fullDataCount: sessionData.fullDataCount || sessionData.data.length
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving session'
    });
  }
});

// Generate AI suggestions for charts with data limits
if (aiService) {
  router.post('/suggest-charts', async (req, res) => {
    try {
      const { sessionId, customFilters, dataLimit } = req.body;
      const sessionData = sessions.get(sessionId);

      if (!sessionData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      console.log(`🤖 Generating suggestions for ${sessionData.data.length} records with limit: ${dataLimit}`);

      // Apply filters first
      let filteredData = sessionData.data;
      if (customFilters && Object.keys(customFilters).length > 0 && calculator) {
        filteredData = calculator.applyFilters(sessionData.data, customFilters, dataLimit);
      }

      // Use sample data for AI analysis instead of full dataset
      const sampleData = sessionData.sampleData || filteredData.slice(0, 100);
      
      // Get AI suggestions using sample
      const suggestions = await aiService.getSuggestions(sessionData.schema, sampleData);

      // Calculate KPIs with data limit
      const kpis = calculator ? 
        calculator.calculateKPIs(filteredData, sessionData.schema, suggestions.kpis, dataLimit) : 
        [];
      
      // Generate chart configurations with data limit
      const charts = calculator ? 
        calculator.generateChartConfigs(filteredData, sessionData.schema, suggestions.charts, dataLimit) : 
        [];

      console.log(`✅ Generated ${kpis.length} KPIs and ${charts.length} charts with data limit: ${dataLimit || 'none'}`);

      res.json({
        success: true,
        suggestions: {
          kpis,
          charts,
          insights: suggestions.insights || []
        },
        performance: {
          totalRecords: sessionData.data.length,
          filteredRecords: filteredData.length,
          displayedRecords: dataLimit ? Math.min(dataLimit, filteredData.length) : filteredData.length,
          isLimited: dataLimit && filteredData.length > dataLimit
        }
      });

    } catch (error) {
      console.error('❌ Suggestions error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating suggestions: ' + error.message
      });
    }
  });
} else {
  router.post('/suggest-charts', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'AI service not available'
    });
  });
}

// Generate final dashboard with filters and data limits
if (calculator && aiService) {
  router.post('/generate-dashboard', async (req, res) => {
    try {
      const { sessionId, filters = {}, selectedMeasures, selectedDimensions, dataLimit } = req.body;
      const sessionData = sessions.get(sessionId);

      if (!sessionData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      console.log(`📊 Generating dashboard with filters and data limit: ${dataLimit}`);

      // Apply filters with data limit for performance
      let filteredData = calculator.applyFilters(sessionData.data, filters, dataLimit);

      // Use sample for AI analysis
      const sampleData = sessionData.sampleData || filteredData.slice(0, 100);
      
      // Get suggestions using sample data
      const suggestions = await aiService.getSuggestions(sessionData.schema, sampleData);

      // Calculate filtered KPIs with data limit
      const kpis = calculator.calculateKPIs(filteredData, sessionData.schema, suggestions.kpis, dataLimit);

      // Generate filtered charts
      let chartConfigs = suggestions.charts;
      if (selectedMeasures || selectedDimensions) {
        chartConfigs = [{
          title: 'Custom Chart',
          type: 'bar',
          measures: selectedMeasures || [sessionData.schema.measures[0]?.name],
          dimensions: selectedDimensions || [sessionData.schema.dimensions[0]?.name]
        }];
      }

      const charts = calculator.generateChartConfigs(filteredData, sessionData.schema, chartConfigs, dataLimit);

      // Get filter options with sampling for large datasets
      const filterOptions = calculator.getFilterOptions(sessionData.data, sessionData.schema);

      console.log(`✅ Dashboard generated with ${charts.length} charts and ${kpis.length} KPIs`);

      res.json({
        success: true,
        dashboard: {
          kpis,
          charts,
          filterOptions,
          activeFilters: filters,
          dataCount: filteredData.length,
          totalCount: sessionData.data.length,
          isLimited: dataLimit && filteredData.length > dataLimit,
          performance: {
            dataLimit: dataLimit,
            totalRecords: sessionData.data.length,
            displayedRecords: dataLimit ? Math.min(dataLimit, filteredData.length) : filteredData.length,
            isLargeDataset: sessionData.stats?.isLargeDataset || false
          }
        }
      });

    } catch (error) {
      console.error('❌ Dashboard generation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating dashboard: ' + error.message
      });
    }
  });
} else {
  router.post('/generate-dashboard', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Dashboard service not available'
    });
  });
}

// Get custom chart combinations with performance optimization
router.post('/custom-chart-combinations', async (req, res) => {
  try {
    const { sessionId, selectedMeasures, selectedDimensions, activeFilters, dataLimit } = req.body;
    const sessionData = sessions.get(sessionId);

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    console.log(`🎨 Generating custom chart combinations with data limit: ${dataLimit}`);

    // Apply filters to data with limit
    let filteredData = sessionData.data;
    if (activeFilters && Object.keys(activeFilters).length > 0) {
      filteredData = calculator.applyFilters(sessionData.data, activeFilters, dataLimit);
    } else if (dataLimit) {
      filteredData = sessionData.data.slice(0, dataLimit);
    }

    // Get AI-powered chart combinations using sample
    const sampleSize = Math.min(filteredData.length, 1000);
    const sampleData = filteredData.slice(0, sampleSize);
    
    const combinations = await aiService.getCustomChartCombinations(
      sessionData.schema,
      selectedMeasures,
      selectedDimensions,
      sampleData
    );

    console.log(`✅ Generated ${combinations.length} chart combinations`);

    res.json({
      success: true,
      combinations,
      performance: {
        totalRecords: sessionData.data.length,
        filteredRecords: filteredData.length,
        displayedRecords: Math.min(sampleSize, filteredData.length),
        isLimited: dataLimit && filteredData.length > dataLimit
      }
    });

  } catch (error) {
    console.error('❌ Custom chart combinations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating chart combinations: ' + error.message
    });
  }
});

// Add custom chart to dashboard with data limits
router.post('/add-custom-chart', async (req, res) => {
  try {
    const { sessionId, chartCombination, activeFilters, dataLimit } = req.body;
    const sessionData = sessions.get(sessionId);

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    console.log(`➕ Adding custom chart with data limit: ${dataLimit}`);

    // Apply filters to data with limit
    let filteredData = sessionData.data;
    if (activeFilters && Object.keys(activeFilters).length > 0) {
      filteredData = calculator.applyFilters(sessionData.data, activeFilters, dataLimit);
    } else if (dataLimit) {
      filteredData = sessionData.data.slice(0, dataLimit);
    }

    // Generate chart configuration with data limit
    const chartConfig = calculator.generateSingleChartConfig(
      filteredData,
      sessionData.schema,
      chartCombination,
      dataLimit
    );

    // Add to session's custom charts
    if (!sessionData.customCharts) {
      sessionData.customCharts = [];
    }
    
    const newChart = {
      ...chartConfig,
      id: `custom_chart_${Date.now()}`,
      isCustom: true,
      addedAt: new Date().toISOString()
    };
    
    sessionData.customCharts.push(newChart);
    sessions.set(sessionId, sessionData);

    console.log('✅ Custom chart added successfully');

    res.json({
      success: true,
      chart: newChart,
      message: 'Custom chart added to dashboard',
      performance: {
        dataLimit: dataLimit,
        chartDataPoints: newChart.dataPoints,
        isLimited: newChart.isLimited
      }
    });

  } catch (error) {
    console.error('❌ Add custom chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding custom chart: ' + error.message
    });
  }
});

// Get dashboard with custom charts and data limits
router.post('/generate-dashboard-with-custom', async (req, res) => {
  try {
    const { sessionId, filters = {}, includeCustomCharts = true, dataLimit } = req.body;
    const sessionData = sessions.get(sessionId);

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    console.log(`📊 Generating dashboard with custom charts and data limit: ${dataLimit}`);

    // Apply filters with data limit
    let filteredData = calculator.applyFilters(sessionData.data, filters, dataLimit);

    // Use sample for AI suggestions
    const sampleData = sessionData.sampleData || filteredData.slice(0, 100);
    
    // Get AI suggestions for default charts
    const suggestions = await aiService.getSuggestions(sessionData.schema, sampleData);

    // Calculate KPIs with data limit
    const kpis = calculator.calculateKPIs(filteredData, sessionData.schema, suggestions.kpis, dataLimit);

    // Generate default charts with data limit
    const defaultCharts = calculator.generateChartConfigs(filteredData, sessionData.schema, suggestions.charts, dataLimit);

    // Include custom charts if requested
    let customCharts = [];
    if (includeCustomCharts && sessionData.customCharts) {
      customCharts = sessionData.customCharts.map(customChart => {
        return calculator.generateSingleChartConfig(
          filteredData,
          sessionData.schema,
          customChart,
          dataLimit
        );
      });
    }

    // Combine all charts
    const allCharts = [...defaultCharts, ...customCharts];

    // Get filter options
    const filterOptions = calculator.getFilterOptions(sessionData.data, sessionData.schema);

    res.json({
      success: true,
      dashboard: {
        kpis,
        charts: allCharts,
        defaultChartsCount: defaultCharts.length,
        customChartsCount: customCharts.length,
        filterOptions,
        activeFilters: filters,
        dataCount: filteredData.length,
        totalCount: sessionData.data.length,
        performance: {
          dataLimit: dataLimit,
          totalRecords: sessionData.data.length,
          displayedRecords: dataLimit ? Math.min(dataLimit, filteredData.length) : filteredData.length,
          isLimited: dataLimit && filteredData.length > dataLimit,
          isLargeDataset: sessionData.stats?.isLargeDataset || false
        }
      }
    });

  } catch (error) {
    console.error('❌ Generate dashboard with custom charts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating dashboard: ' + error.message
    });
  }
});

// Remove custom chart
router.delete('/custom-chart/:sessionId/:chartId', async (req, res) => {
  try {
    const { sessionId, chartId } = req.params;
    const sessionData = sessions.get(sessionId);

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (!sessionData.customCharts) {
      return res.status(404).json({
        success: false,
        message: 'No custom charts found'
      });
    }

    const initialLength = sessionData.customCharts.length;
    sessionData.customCharts = sessionData.customCharts.filter(chart => chart.id !== chartId);
    
    if (sessionData.customCharts.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Custom chart not found'
      });
    }

    sessions.set(sessionId, sessionData);

    console.log('🗑️ Custom chart removed:', chartId);

    res.json({
      success: true,
      message: 'Custom chart removed successfully'
    });

  } catch (error) {
    console.error('❌ Remove custom chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing custom chart: ' + error.message
    });
  }
});

// Get available filter options with sampling for large datasets
if (calculator) {
  router.get('/filters/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const { sample = 'true' } = req.query; // Allow disabling sampling
      const sessionData = sessions.get(sessionId);

      if (!sessionData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Use sampling for large datasets by default
      const useSampling = sample !== 'false' && sessionData.data.length > 10000;
      const sampleSize = useSampling ? 10000 : sessionData.data.length;
      
      const filterOptions = calculator.getFilterOptions(
        sessionData.data, 
        sessionData.schema, 
        sampleSize
      );

      res.json({
        success: true,
        filters: filterOptions,
        metadata: {
          totalRecords: sessionData.data.length,
          sampledRecords: sampleSize,
          isSampled: useSampling
        }
      });

    } catch (error) {
      console.error('❌ Filters error:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting filter options'
      });
    }
  });
} else {
  router.get('/filters/:sessionId', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Filter service not available'
    });
  });
}

// Get all sessions (for debugging)
router.get('/sessions', (req, res) => {
  const sessionList = Array.from(sessions.keys()).map(key => {
    const sessionData = sessions.get(key);
    return {
      sessionId: key,
      fileName: sessionData?.fileName,
      uploadTime: sessionData?.uploadTime,
      rowCount: sessionData?.fullDataCount || sessionData?.data?.length || 0,
      isLargeDataset: sessionData?.stats?.isLargeDataset || false
    };
  });

  res.json({
    success: true,
    sessions: sessionList,
    totalSessions: sessionList.length
  });
});

// Clear all sessions (for debugging)
router.delete('/sessions', (req, res) => {
  const count = sessions.size;
  sessions.clear();
  
  // Also clear calculator cache
  if (calculator) {
    calculator.clearCache();
  }
  
  res.json({
    success: true,
    message: `Cleared ${count} sessions and calculator cache`
  });
});

module.exports = router;