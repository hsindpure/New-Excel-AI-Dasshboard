// backend/routes/api.js
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
      'POST /api/generate-dashboard'
    ]
  });
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

      // Process the file
      const result = await dataProcessor.processFile(req.file);
      
      // Create session
      const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // Store in session
      sessions.set(sessionId, {
        ...result,
        fileName: req.file.originalname,
        uploadTime: new Date().toISOString()
      });

      console.log('✅ File processed successfully. Session ID:', sessionId);

      res.json({
        success: true,
        sessionId,
        message: 'File processed successfully',
        preview: {
          fileName: req.file.originalname,
          rowCount: result.data.length,
          columns: result.schema.columns.length,
          schema: result.schema
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

    res.json({
      success: true,
      data: sessionData
    });

  } catch (error) {
    console.error('❌ Session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving session'
    });
  }
});

// Generate AI suggestions for charts
if (aiService) {
  router.post('/suggest-charts', async (req, res) => {
    try {
      const { sessionId, customFilters } = req.body;
      const sessionData = sessions.get(sessionId);

      if (!sessionData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      console.log('🤖 Generating suggestions...');

      // Get AI suggestions
      const suggestions = await aiService.getSuggestions(sessionData.schema);

      // Apply any custom filters
      let filteredData = sessionData.data;
      if (customFilters && Object.keys(customFilters).length > 0 && calculator) {
        filteredData = calculator.applyFilters(sessionData.data, customFilters);
      }

      // Calculate KPIs based on suggestions
      const kpis = calculator ? calculator.calculateKPIs(filteredData, sessionData.schema, suggestions.kpis) : [];
      
      // Generate chart configurations
      const charts = calculator ? calculator.generateChartConfigs(filteredData, sessionData.schema, suggestions.charts) : [];

      console.log('✅ Generated', kpis.length, 'KPIs and', charts.length, 'charts');

      res.json({
        success: true,
        suggestions: {
          kpis,
          charts,
          insights: suggestions.insights || []
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

// Generate final dashboard with filters
if (calculator && aiService) {
  router.post('/generate-dashboard', async (req, res) => {
    try {
      const { sessionId, filters = {}, selectedMeasures, selectedDimensions } = req.body;
      const sessionData = sessions.get(sessionId);

      if (!sessionData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      console.log('📊 Generating dashboard with filters:', filters);

      // Apply filters
      let filteredData = calculator.applyFilters(sessionData.data, filters);

      // Get suggestions (cached or generate new)
      const suggestions = await aiService.getSuggestions(sessionData.schema);

      // Calculate filtered KPIs
      const kpis = calculator.calculateKPIs(filteredData, sessionData.schema, suggestions.kpis);

      // Generate filtered charts
      let chartConfigs = suggestions.charts;
      if (selectedMeasures || selectedDimensions) {
        // Custom chart generation based on user selection
        chartConfigs = [{
          title: 'Custom Chart',
          type: 'bar',
          measures: selectedMeasures || [sessionData.schema.measures[0]?.name],
          dimensions: selectedDimensions || [sessionData.schema.dimensions[0]?.name]
        }];
      }

      const charts = calculator.generateChartConfigs(filteredData, sessionData.schema, chartConfigs);

      // Get filter options for the sidebar
      const filterOptions = calculator.getFilterOptions(sessionData.data, sessionData.schema);

      console.log('✅ Dashboard generated successfully');

      res.json({
        success: true,
        dashboard: {
          kpis,
          charts,
          filterOptions,
          activeFilters: filters,
          dataCount: filteredData.length,
          totalCount: sessionData.data.length
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

// Get available filter options
if (calculator) {
  router.get('/filters/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const sessionData = sessions.get(sessionId);

      if (!sessionData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const filterOptions = calculator.getFilterOptions(sessionData.data, sessionData.schema);

      res.json({
        success: true,
        filters: filterOptions
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
  const sessionList = Array.from(sessions.keys()).map(key => ({
    sessionId: key,
    fileName: sessions.get(key)?.fileName,
    uploadTime: sessions.get(key)?.uploadTime,
    rowCount: sessions.get(key)?.data?.length || 0
  }));

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
  res.json({
    success: true,
    message: `Cleared ${count} sessions`
  });
});


// backend/routes/api.js - Add these new routes to existing file

// Add these new routes to the existing api.js file

// Get custom chart combinations using AI analysis
router.post('/custom-chart-combinations', async (req, res) => {
    try {
      const { sessionId, selectedMeasures, selectedDimensions, activeFilters } = req.body;
      const sessionData = sessions.get(sessionId);
  
      if (!sessionData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
  
      console.log('🎨 Generating custom chart combinations for:', {
        sessionId,
        selectedMeasures,
        selectedDimensions,
        activeFilters
      });
  
      // Apply filters to data if any
      let filteredData = sessionData.data;
      if (activeFilters && Object.keys(activeFilters).length > 0) {
        filteredData = calculator.applyFilters(sessionData.data, activeFilters);
      }
  
      // Get AI-powered chart combinations
      const combinations = await aiService.getCustomChartCombinations(
        sessionData.schema,
        selectedMeasures,
        selectedDimensions,
        filteredData
      );
  
      console.log('✅ Generated', combinations.length, 'chart combinations');
  
      res.json({
        success: true,
        combinations,
        dataCount: filteredData.length,
        totalCount: sessionData.data.length
      });
  
    } catch (error) {
      console.error('❌ Custom chart combinations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating chart combinations: ' + error.message
      });
    }
  });
  
  // Add custom chart to dashboard
  router.post('/add-custom-chart', async (req, res) => {
    try {
      const { sessionId, chartCombination, activeFilters } = req.body;
      const sessionData = sessions.get(sessionId);
  
      if (!sessionData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
  
      console.log('➕ Adding custom chart to dashboard:', chartCombination);
  
      // Apply filters to data if any
      let filteredData = sessionData.data;
      if (activeFilters && Object.keys(activeFilters).length > 0) {
        filteredData = calculator.applyFilters(sessionData.data, activeFilters);
      }
  
      // Generate chart configuration
      const chartConfig = calculator.generateSingleChartConfig(
        filteredData,
        sessionData.schema,
        chartCombination
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
        message: 'Custom chart added to dashboard'
      });
  
    } catch (error) {
      console.error('❌ Add custom chart error:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding custom chart: ' + error.message
      });
    }
  });
  
  // Get dashboard with custom charts included
  router.post('/generate-dashboard-with-custom', async (req, res) => {
    try {
      const { sessionId, filters = {}, includeCustomCharts = true } = req.body;
      const sessionData = sessions.get(sessionId);
  
      if (!sessionData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
  
      console.log('📊 Generating dashboard with custom charts:', {
        sessionId,
        filters,
        includeCustomCharts
      });
  
      // Apply filters
      let filteredData = calculator.applyFilters(sessionData.data, filters);
  
      // Get AI suggestions for default charts
      const suggestions = await aiService.getSuggestions(sessionData.schema);
  
      // Calculate KPIs
      const kpis = calculator.calculateKPIs(filteredData, sessionData.schema, suggestions.kpis);
  
      // Generate default charts
      const defaultCharts = calculator.generateChartConfigs(filteredData, sessionData.schema, suggestions.charts);
  
      // Include custom charts if requested
      let customCharts = [];
      if (includeCustomCharts && sessionData.customCharts) {
        customCharts = sessionData.customCharts.map(customChart => {
          // Regenerate custom chart with current filtered data
          return calculator.generateSingleChartConfig(
            filteredData,
            sessionData.schema,
            customChart
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
          totalCount: sessionData.data.length
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
  
      // Remove the custom chart
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





module.exports = router;