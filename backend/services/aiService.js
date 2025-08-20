// backend/services/aiService.js

class AIService {
    constructor() {
      this.apiKey = process.env.OPENROUTER_API_KEY;
      this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
      
      // Cache for AI suggestions to avoid repeated calls
      this.cache = new Map();
    }
    
    async getSuggestions(schema) {
      try {
        // Create cache key based on schema
        const cacheKey = this.generateCacheKey(schema);
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
          console.log('📋 Using cached AI suggestions');
          const cachedSuggestions = this.cache.get(cacheKey);
          console.log('🔄 Cached suggestions returned:', JSON.stringify(cachedSuggestions, null, 2));
          return cachedSuggestions;
        }
        
        console.log('🤖 Requesting AI suggestions...');
        console.log('📊 Schema data being sent to AI:', JSON.stringify({
          measures: schema.measures.map(m => ({ name: m.name, type: m.type, uniqueValues: m.uniqueValues })),
          dimensions: schema.dimensions.map(d => ({ name: d.name, type: d.type, uniqueValues: d.uniqueValues })),
          totalColumns: schema.columns.length
        }, null, 2));
        
        // Try AI first, fall back to rule-based if it fails
        let suggestions;
        try {
          suggestions = await this.getAISuggestions(schema);
          console.log('✅ AI suggestions received:', JSON.stringify(suggestions, null, 2));
        } catch (error) {
          console.warn('⚠️ AI service failed, using fallback:', error.message);
          suggestions = this.getFallbackSuggestions(schema);
          console.log('🔄 Fallback suggestions generated:', JSON.stringify(suggestions, null, 2));
        }
        
        // Cache the results
        this.cache.set(cacheKey, suggestions);
        
        return suggestions;
        
      } catch (error) {
        console.error('❌ AI service error:', error);
        const fallbackSuggestions = this.getFallbackSuggestions(schema);
        console.log('🔄 Emergency fallback suggestions:', JSON.stringify(fallbackSuggestions, null, 2));
        return fallbackSuggestions;
      }
    }
    
    async getAISuggestions(schema) {
      if (!this.apiKey) {
        console.log('⚠️ No AI API key configured, skipping AI suggestions');
        throw new Error('AI API key not configured');
      }
      
      const prompt = this.buildPrompt(schema);
      console.log('📝 AI Prompt being sent:', prompt);
      
      const requestPayload = {
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      };
      
      console.log('🚀 Sending request to AI server:', JSON.stringify(requestPayload, null, 2));
      
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestPayload)
      });
      
      console.log('📡 AI Server response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ AI API error response:', response.status, response.statusText, errorText);
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📋 Raw AI response data:', JSON.stringify(data, null, 2));
      
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        console.error('❌ No AI response content received');
        throw new Error('No AI response received');
      }
      
      console.log('📝 AI response content:', content);
      
      // Parse and validate AI response
      const parsedSuggestions = this.parseAIResponse(content, schema);
      console.log('✅ Parsed AI suggestions:', JSON.stringify(parsedSuggestions, null, 2));
      
      return parsedSuggestions;
    }
  
    // Add the custom chart combinations method with fixed API call
    async getCustomChartCombinations(schema, selectedMeasures, selectedDimensions, filteredData) {
      try {
        console.log('🎨 Generating custom chart combinations...');
        console.log('📊 Selected measures:', selectedMeasures);
        console.log('📋 Selected dimensions:', selectedDimensions);
        console.log('📈 Data sample size:', filteredData.length);
  
        // Try AI first, fall back to rule-based if it fails
        let combinations;
        try {
          combinations = await this.getAICustomCombinations(schema, selectedMeasures, selectedDimensions, filteredData);
          console.log('✅ AI custom combinations generated:', combinations.length);
        } catch (error) {
          console.warn('⚠️ AI custom combinations failed, using fallback:', error.message);
          combinations = this.getFallbackCustomCombinations(schema, selectedMeasures, selectedDimensions, filteredData);
          console.log('🔄 Fallback custom combinations generated:', combinations.length);
        }
  
        return combinations;
  
      } catch (error) {
        console.error('❌ Custom combinations error:', error);
        return this.getFallbackCustomCombinations(schema, selectedMeasures, selectedDimensions, filteredData);
      }
    }
  
    async getAICustomCombinations(schema, selectedMeasures, selectedDimensions, filteredData) {
      if (!this.apiKey) {
        throw new Error('AI API key not configured');
      }
  
      const prompt = this.buildCustomCombinationsPrompt(schema, selectedMeasures, selectedDimensions, filteredData);
      console.log('📝 AI Custom Combinations Prompt:', prompt);
  
      const requestPayload = {
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      };
  
      console.log('🚀 Sending custom combinations request to AI:', JSON.stringify(requestPayload, null, 2));
  
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestPayload)
      });
  
      console.log('📡 AI Custom Combinations response status:', response.status);
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ AI API error response:', response.status, response.statusText, errorText);
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }
  
      const data = await response.json();
      console.log('📋 Raw AI custom combinations response:', JSON.stringify(data, null, 2));
  
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No AI response received');
      }
  
      console.log('📝 AI custom combinations content:', content);
  
      // Parse and validate AI response
      const combinations = this.parseAICustomCombinations(content, selectedMeasures, selectedDimensions);
      console.log('✅ Parsed AI custom combinations:', JSON.stringify(combinations, null, 2));
  
      return combinations;
    }
    
    buildPrompt(schema) {
      const measures = schema.measures.map(m => `${m.name} (${m.type}, ${m.uniqueValues} unique values)`).join(', ');
      const dimensions = schema.dimensions.map(d => `${d.name} (${d.type}, ${d.uniqueValues} unique values)`).join(', ');
      
      const prompt = `You are a data visualization expert. Analyze this dataset schema and suggest 4 relevant KPIs and 4 chart visualizations:
  
  MEASURES (numeric columns): ${measures || 'None'}
  DIMENSIONS (categorical columns): ${dimensions || 'None'}
  
  Return a JSON response with this exact structure:
  {
    "kpis": [
      {
        "name": "Total Revenue",
        "calculation": "sum",
        "column": "revenue",
        "format": "currency"
      }
    ],
    "charts": [
      {
        "title": "Revenue by Region",
        "type": "bar",
        "measures": ["revenue"],
        "dimensions": ["region"]
      }
    ],
    "insights": [
      "Revenue trends show seasonal patterns"
    ]
  }
  
  Focus on business-relevant metrics. Chart types: bar, line, pie, area, scatter.`;
  
      console.log('📝 Generated prompt for AI:', prompt);
      return prompt;
    }
  
    buildCustomCombinationsPrompt(schema, selectedMeasures, selectedDimensions, filteredData) {
      // Analyze data patterns
      const dataInsights = this.analyzeDataPatterns(filteredData, selectedMeasures, selectedDimensions);
      
      const prompt = `You are an expert data visualization analyst. Analyze this data selection and suggest 3-4 optimal chart combinations:
  
  SELECTED MEASURES: ${selectedMeasures.join(', ')}
  SELECTED DIMENSIONS: ${selectedDimensions.join(', ')}
  
  DATA INSIGHTS:
  - Total records: ${filteredData.length}
  - Measure statistics: ${JSON.stringify(dataInsights.measureStats)}
  - Dimension cardinality: ${JSON.stringify(dataInsights.dimensionStats)}
  - Data patterns: ${dataInsights.patterns.join(', ')}
  
  AVAILABLE CHART TYPES: bar, line, pie, area, scatter
  
  Create 3-4 chart combinations that provide different analytical perspectives. Consider:
  1. Best chart type for the data relationship
  2. Business insights the combination reveals
  3. Visual clarity and effectiveness
  4. Complementary analysis angles
  
  Return JSON with this exact structure:
  {
    "combinations": [
      {
        "title": "Revenue Analysis by Region",
        "type": "bar",
        "measures": ["revenue"],
        "dimensions": ["region"],
        "aiSuggestion": "Bar chart effectively shows revenue comparison across regions",
        "reasoning": "Best for categorical comparison",
        "insights": ["Regional performance gaps", "Top performing markets"],
        "isAiGenerated": true
      }
    ]
  }
  
  Focus on creating diverse, insightful combinations that reveal different aspects of the data.`;
  
      console.log('📝 Generated custom combinations prompt:', prompt);
      return prompt;
    }
  
    analyzeDataPatterns(filteredData, selectedMeasures, selectedDimensions) {
      const insights = {
        measureStats: {},
        dimensionStats: {},
        patterns: []
      };
  
      // Analyze measures
      selectedMeasures.forEach(measure => {
        const values = filteredData.map(row => parseFloat(row[measure]) || 0);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        
        insights.measureStats[measure] = {
          min,
          max,
          avg: Math.round(avg * 100) / 100,
          range: max - min,
          variance: this.calculateVariance(values)
        };
  
        // Detect patterns
        if (max / min > 10) insights.patterns.push('High variance in ' + measure);
        if (values.filter(v => v === 0).length > values.length * 0.3) {
          insights.patterns.push('Many zero values in ' + measure);
        }
      });
  
      // Analyze dimensions
      selectedDimensions.forEach(dimension => {
        const uniqueValues = [...new Set(filteredData.map(row => row[dimension]))];
        insights.dimensionStats[dimension] = {
          uniqueCount: uniqueValues.length,
          values: uniqueValues.slice(0, 5), // Sample values
          isHighCardinality: uniqueValues.length > 20
        };
  
        // Detect patterns
        if (uniqueValues.length <= 5) insights.patterns.push('Low cardinality in ' + dimension);
        if (uniqueValues.length > 50) insights.patterns.push('High cardinality in ' + dimension);
      });
  
      return insights;
    }
  
    calculateVariance(values) {
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
      return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    }
  
    parseAICustomCombinations(content, selectedMeasures, selectedDimensions) {
      try {
        console.log('🔍 Parsing AI custom combinations response...');
        
        // Extract JSON from response
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        
        console.log('📋 Extracted JSON string:', jsonStr);
        
        const parsed = JSON.parse(jsonStr);
        console.log('✅ Successfully parsed JSON:', JSON.stringify(parsed, null, 2));
        
        // Validate and clean combinations
        const validCombinations = this.validateCustomCombinations(parsed.combinations || [], selectedMeasures, selectedDimensions);
        console.log('✅ Validated custom combinations:', validCombinations.length);
        
        return validCombinations;
        
      } catch (error) {
        console.warn('⚠️ Could not parse AI custom combinations, using fallback. Error:', error.message);
        return this.getFallbackCustomCombinations({}, selectedMeasures, selectedDimensions, []);
      }
    }
  
    validateCustomCombinations(combinations, selectedMeasures, selectedDimensions) {
      const validCombinations = [];
      
      combinations.forEach((combo, index) => {
        if (combo.type && combo.measures && combo.dimensions) {
          // Ensure measures and dimensions are from selected lists
          const validMeasures = combo.measures.filter(m => selectedMeasures.includes(m));
          const validDimensions = combo.dimensions.filter(d => selectedDimensions.includes(d));
          
          if (validMeasures.length > 0 && validDimensions.length > 0) {
            validCombinations.push({
              title: combo.title || `${combo.type.charAt(0).toUpperCase() + combo.type.slice(1)} Chart ${index + 1}`,
              type: combo.type,
              measures: validMeasures,
              dimensions: validDimensions,
              aiSuggestion: combo.aiSuggestion || combo.reasoning || 'AI-generated chart combination',
              insights: combo.insights || [],
              isAiGenerated: true
            });
          }
        }
      });
      
      return validCombinations;
    }
    
    parseAIResponse(content, schema) {
      try {
        console.log('🔍 Parsing AI response content:', content);
        
        // Extract JSON from response (handle markdown formatting)
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        
        console.log('📋 Extracted JSON string:', jsonStr);
        
        const parsed = JSON.parse(jsonStr);
        console.log('✅ Successfully parsed JSON:', JSON.stringify(parsed, null, 2));
        
        // Validate and sanitize the response
        const validatedSuggestions = this.validateSuggestions(parsed, schema);
        console.log('✅ Validated suggestions:', JSON.stringify(validatedSuggestions, null, 2));
        
        return validatedSuggestions;
        
      } catch (error) {
        console.warn('⚠️ Could not parse AI response, using fallback. Error:', error.message);
        console.log('📋 Original content that failed to parse:', content);
        return this.getFallbackSuggestions(schema);
      }
    }
    
    validateSuggestions(suggestions, schema) {
      console.log('🔍 Validating AI suggestions against schema...');
      
      const validSuggestions = {
        kpis: [],
        charts: [],
        insights: suggestions.insights || []
      };
      
      // Validate KPIs
      if (suggestions.kpis && Array.isArray(suggestions.kpis)) {
        console.log('📊 Validating KPIs...');
        suggestions.kpis.forEach((kpi, index) => {
          console.log(`🔍 Validating KPI ${index + 1}:`, JSON.stringify(kpi, null, 2));
          
          if (kpi.name && kpi.column && (schema.measures.find(m => m.name === kpi.column) || kpi.column === '*')) {
            const validKpi = {
              name: kpi.name,
              calculation: kpi.calculation || 'sum',
              column: kpi.column,
              format: kpi.format || 'number'
            };
            validSuggestions.kpis.push(validKpi);
            console.log('✅ Valid KPI added:', JSON.stringify(validKpi, null, 2));
          } else {
            console.log('❌ Invalid KPI rejected:', JSON.stringify(kpi, null, 2));
          }
        });
      }
      
      // Validate Charts
      if (suggestions.charts && Array.isArray(suggestions.charts)) {
        console.log('📈 Validating Charts...');
        suggestions.charts.forEach((chart, index) => {
          console.log(`🔍 Validating Chart ${index + 1}:`, JSON.stringify(chart, null, 2));
          
          if (chart.title && chart.type && chart.measures && chart.dimensions) {
            const validMeasures = chart.measures.filter(m => 
              schema.measures.find(measure => measure.name === m)
            );
            const validDimensions = chart.dimensions.filter(d => 
              schema.dimensions.find(dim => dim.name === d)
            );
            
            console.log(`🔍 Valid measures found: ${validMeasures.length}/${chart.measures.length}`);
            console.log(`🔍 Valid dimensions found: ${validDimensions.length}/${chart.dimensions.length}`);
            
            if (validMeasures.length > 0 && validDimensions.length > 0) {
              const validChart = {
                title: chart.title,
                type: chart.type,
                measures: validMeasures,
                dimensions: validDimensions
              };
              validSuggestions.charts.push(validChart);
              console.log('✅ Valid Chart added:', JSON.stringify(validChart, null, 2));
            } else {
              console.log('❌ Invalid Chart rejected - no valid measures or dimensions');
            }
          } else {
            console.log('❌ Invalid Chart rejected - missing required fields');
          }
        });
      }
      
      // Ensure we have at least some suggestions
      if (validSuggestions.kpis.length === 0 || validSuggestions.charts.length === 0) {
        console.log('⚠️ Insufficient valid suggestions, falling back to defaults');
        return this.getFallbackSuggestions(schema);
      }
      
      console.log('✅ Final validated suggestions:', JSON.stringify(validSuggestions, null, 2));
      return validSuggestions;
    }
    
    getFallbackSuggestions(schema) {
      console.log('🔄 Generating fallback AI suggestions');
      console.log('📊 Schema for fallback:', JSON.stringify({
        measures: schema.measures.length,
        dimensions: schema.dimensions.length,
        columns: schema.columns.length
      }, null, 2));
      
      const kpis = [];
      const charts = [];
      
      // Generate KPIs from numeric columns
      schema.measures.slice(0, 4).forEach((measure, index) => {
        const kpi = {
          name: `Total ${this.formatColumnName(measure.name)}`,
          calculation: 'sum',
          column: measure.name,
          format: this.guessNumberFormat(measure.name)
        };
        kpis.push(kpi);
        console.log(`✅ Generated fallback KPI ${index + 1}:`, JSON.stringify(kpi, null, 2));
      });
      
      // Add count KPI if we have data
      if (schema.columns.length > 0) {
        const countKpi = {
          name: 'Total Records',
          calculation: 'count',
          column: '*',
          format: 'number'
        };
        kpis.unshift(countKpi);
        console.log('✅ Generated count KPI:', JSON.stringify(countKpi, null, 2));
      }
      
      // Generate charts
      if (schema.measures.length > 0 && schema.dimensions.length > 0) {
        const primaryMeasure = schema.measures[0];
        const primaryDimension = schema.dimensions[0];
        
        console.log('📊 Primary measure:', JSON.stringify(primaryMeasure, null, 2));
        console.log('📊 Primary dimension:', JSON.stringify(primaryDimension, null, 2));
        
        // Bar chart
        const barChart = {
          title: `${this.formatColumnName(primaryMeasure.name)} by ${this.formatColumnName(primaryDimension.name)}`,
          type: 'bar',
          measures: [primaryMeasure.name],
          dimensions: [primaryDimension.name]
        };
        charts.push(barChart);
        console.log('✅ Generated bar chart:', JSON.stringify(barChart, null, 2));
        
        // Line chart if we have multiple measures
        if (schema.measures.length > 1) {
          const lineChart = {
            title: `${this.formatColumnName(primaryMeasure.name)} Trend`,
            type: 'line',
            measures: [primaryMeasure.name],
            dimensions: [primaryDimension.name]
          };
          charts.push(lineChart);
          console.log('✅ Generated line chart:', JSON.stringify(lineChart, null, 2));
        }
        
        // Add pie chart for categorical data
        if (primaryDimension.uniqueValues <= 10) {
          const pieChart = {
            title: `${this.formatColumnName(primaryMeasure.name)} Distribution`,
            type: 'pie',
            measures: [primaryMeasure.name],
            dimensions: [primaryDimension.name]
          };
          charts.push(pieChart);
          console.log('✅ Generated pie chart:', JSON.stringify(pieChart, null, 2));
        }
        
        // Add area chart if we have time-based dimension
        const timeDimension = schema.dimensions.find(d => d.type === 'date');
        if (timeDimension) {
          const areaChart = {
            title: `${this.formatColumnName(primaryMeasure.name)} Over Time`,
            type: 'area',
            measures: [primaryMeasure.name],
            dimensions: [timeDimension.name]
          };
          charts.push(areaChart);
          console.log('✅ Generated area chart:', JSON.stringify(areaChart, null, 2));
        }
      }
      
      const finalSuggestions = {
        kpis: kpis.slice(0, 4),
        charts: charts.slice(0, 4),
        insights: [
          'Dashboard generated using smart defaults',
          'Customize by selecting different measures and dimensions',
          `Found ${schema.measures.length} numeric columns and ${schema.dimensions.length} categorical columns`
        ]
      };
      
      console.log('✅ Final fallback suggestions:', JSON.stringify(finalSuggestions, null, 2));
      return finalSuggestions;
    }
  
    getFallbackCustomCombinations(schema, selectedMeasures, selectedDimensions, filteredData) {
      console.log('🔄 Generating fallback custom combinations');
      
      const combinations = [];
      const chartTypes = ['bar', 'line', 'pie', 'area'];
      
      // Generate combinations based on data characteristics
      chartTypes.forEach((chartType, index) => {
        if (combinations.length >= 4) return; // Limit to 4 combinations
        
        // Select appropriate measures and dimensions for each chart type
        let selectedMeasure = selectedMeasures[0];
        let selectedDimension = selectedDimensions[0];
        
        // Adjust selection based on chart type
        switch (chartType) {
          case 'pie':
            // Pie charts work best with low cardinality dimensions
            selectedDimension = selectedDimensions.find(dim => {
              const measure = schema.dimensions?.find(d => d.name === dim);
              return measure?.uniqueValues <= 10;
            }) || selectedDimensions[0];
            break;
          
          case 'line':
            // Line charts work well with time-based or ordered dimensions
            selectedDimension = selectedDimensions.find(dim => {
              const measure = schema.dimensions?.find(d => d.name === dim);
              return measure?.type === 'date';
            }) || selectedDimensions[0];
            break;
          
          case 'bar':
            // Bar charts are versatile, use as-is
            break;
          
          case 'area':
            // Area charts work well with continuous data
            if (selectedMeasures.length > 1) {
              selectedMeasure = selectedMeasures.slice(0, 2); // Multiple measures
            }
            break;
        }
  
        const combination = {
          title: `${this.formatColumnName(selectedMeasure)} by ${this.formatColumnName(selectedDimension)}`,
          type: chartType,
          measures: Array.isArray(selectedMeasure) ? selectedMeasure : [selectedMeasure],
          dimensions: [selectedDimension],
          aiSuggestion: this.getFallbackSuggestion(chartType, selectedMeasure, selectedDimension),
          insights: this.getFallbackInsights(chartType, selectedMeasure, selectedDimension),
          isAiGenerated: false
        };
        
        combinations.push(combination);
      });
      
      console.log('✅ Generated fallback combinations:', combinations.length);
      return combinations;
    }
  
    getFallbackSuggestion(chartType, measure, dimension) {
      const suggestions = {
        bar: `Bar chart effectively compares ${this.formatColumnName(measure)} across different ${this.formatColumnName(dimension)} categories`,
        line: `Line chart shows trends and patterns in ${this.formatColumnName(measure)} over ${this.formatColumnName(dimension)}`,
        pie: `Pie chart displays the distribution of ${this.formatColumnName(measure)} by ${this.formatColumnName(dimension)}`,
        area: `Area chart visualizes cumulative ${this.formatColumnName(measure)} trends across ${this.formatColumnName(dimension)}`,
        scatter: `Scatter plot reveals relationships between ${this.formatColumnName(measure)} and ${this.formatColumnName(dimension)}`
      };
      
      return suggestions[chartType] || 'Recommended chart type for this data combination';
    }
  
    getFallbackInsights(chartType, measure, dimension) {
      const insights = {
        bar: ['Category comparison', 'Performance ranking', 'Relative values'],
        line: ['Trend analysis', 'Pattern recognition', 'Time-based changes'],
        pie: ['Proportional analysis', 'Market share view', 'Composition breakdown'],
        area: ['Cumulative trends', 'Volume analysis', 'Stacked comparison'],
        scatter: ['Correlation analysis', 'Outlier detection', 'Relationship strength']
      };
      
      return insights[chartType] || ['Data analysis', 'Business insights'];
    }
    
    formatColumnName(name) {
      return name
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    guessNumberFormat(columnName) {
      const name = columnName.toLowerCase();
      if (name.includes('revenue') || name.includes('sales') || name.includes('price') || name.includes('cost')) {
        return 'currency';
      }
      if (name.includes('percent') || name.includes('rate') || name.includes('%')) {
        return 'percent';
      }
      return 'number';
    }
    
    generateCacheKey(schema) {
      const key = schema.columns.map(c => `${c.name}:${c.type}`).join('|');
      return Buffer.from(key).toString('base64').slice(0, 20);
    }
  }
  
  module.exports = new AIService();