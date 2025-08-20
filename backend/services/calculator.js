// backend/services/calculator.js

class Calculator {
  
    calculateKPIs(data, schema, kpiDefinitions) {
      const kpis = [];
      
      kpiDefinitions.forEach(def => {
        try {
          const kpi = this.calculateSingleKPI(data, def);
          if (kpi) {
            kpis.push(kpi);
          }
        } catch (error) {
          console.warn(`⚠️ Error calculating KPI ${def.name}:`, error.message);
        }
      });
      
      return kpis;
    }
    
    calculateSingleKPI(data, definition) {
      let value = 0;
      
      switch (definition.calculation.toLowerCase()) {
        case 'sum':
          value = data.reduce((sum, row) => {
            const val = parseFloat(row[definition.column]) || 0;
            return sum + val;
          }, 0);
          break;
          
        case 'avg':
        case 'average':
          const sum = data.reduce((sum, row) => {
            const val = parseFloat(row[definition.column]) || 0;
            return sum + val;
          }, 0);
          value = data.length > 0 ? sum / data.length : 0;
          break;
          
        case 'count':
          if (definition.column === '*') {
            value = data.length;
          } else {
            value = data.filter(row => 
              row[definition.column] !== null && 
              row[definition.column] !== undefined && 
              row[definition.column] !== ''
            ).length;
          }
          break;
          
        case 'max':
          value = Math.max(...data.map(row => parseFloat(row[definition.column]) || 0));
          break;
          
        case 'min':
          value = Math.min(...data.map(row => parseFloat(row[definition.column]) || 0));
          break;
          
        default:
          console.warn(`Unknown calculation type: ${definition.calculation}`);
          return null;
      }
      
      return {
        name: definition.name,
        value: value,
        formattedValue: this.formatValue(value, definition.format),
        calculation: definition.calculation,
        column: definition.column,
        format: definition.format
      };
    }
    
    formatValue(value, format) {
      if (isNaN(value) || !isFinite(value)) {
        return '0';
      }
      
      switch (format?.toLowerCase()) {
        case 'currency':
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }).format(value);
          
        case 'percent':
          return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          }).format(value / 100);
          
        case 'number':
        default:
          if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
          } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'K';
          } else {
            return value.toLocaleString();
          }
      }
    }
    
    generateChartConfigs(data, schema, chartDefinitions) {
      const charts = [];
      
      chartDefinitions.forEach((def, index) => {
        try {
          const chartData = this.prepareChartData(data, def);
          if (chartData && chartData.length > 0) {
            charts.push({
              id: `chart_${index}`,
              title: def.title,
              type: def.type,
              data: chartData,
              measures: def.measures,
              dimensions: def.dimensions,
              config: this.generateChartOption(def.type, chartData, def.measures, def.dimensions)
            });
          }
        } catch (error) {
          console.warn(`⚠️ Error generating chart ${def.title}:`, error.message);
        }
      });
      
      return charts;
    }
    
    prepareChartData(data, chartDef) {
      const { measures, dimensions, type } = chartDef;
      
      if (!measures || !dimensions || measures.length === 0 || dimensions.length === 0) {
        return [];
      }
      
      const primaryDimension = dimensions[0];
      const primaryMeasure = measures[0];
      
      // Group data by primary dimension
      const grouped = this.groupByDimension(data, primaryDimension);
      
      // Calculate aggregated values
      const chartData = Object.keys(grouped).map(key => {
        const group = grouped[key];
        const dataPoint = { [primaryDimension]: key };
        
        measures.forEach(measure => {
          const values = group.map(row => parseFloat(row[measure]) || 0);
          dataPoint[measure] = values.reduce((sum, val) => sum + val, 0);
        });
        
        return dataPoint;
      });
      
      // Sort data for better visualization
      return this.sortChartData(chartData, primaryMeasure, type);
    }
    
    groupByDimension(data, dimension) {
      return data.reduce((groups, row) => {
        const key = row[dimension] || 'Unknown';
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(row);
        return groups;
      }, {});
    }
    
    sortChartData(data, primaryMeasure, chartType) {
      // Different sorting strategies for different chart types
      switch (chartType) {
        case 'pie':
          // Sort pie charts by value (descending)
          return data.sort((a, b) => (b[primaryMeasure] || 0) - (a[primaryMeasure] || 0));
          
        case 'line':
        case 'area':
          // Sort line/area charts by dimension (usually time-based)
          return data.sort((a, b) => {
            const aKey = Object.keys(a).find(k => k !== primaryMeasure);
            const bKey = Object.keys(b).find(k => k !== primaryMeasure);
            return String(a[aKey]).localeCompare(String(b[bKey]));
          });
          
        case 'bar':
        default:
          // Sort bar charts by value (descending) for better readability
          return data.sort((a, b) => (b[primaryMeasure] || 0) - (a[primaryMeasure] || 0));
      }
    }
    
    generateChartOption(type, data, measures, dimensions) {
      // This generates configuration for Recharts components
      const primaryMeasure = measures[0];
      const primaryDimension = dimensions[0];
      
      const baseConfig = {
        data: data,
        margin: { top: 20, right: 30, left: 20, bottom: 5 }
      };
      
      switch (type) {
        case 'bar':
          return {
            ...baseConfig,
            type: 'BarChart',
            dataKey: primaryMeasure,
            xAxisKey: primaryDimension
          };
          
        case 'line':
          return {
            ...baseConfig,
            type: 'LineChart',
            dataKey: primaryMeasure,
            xAxisKey: primaryDimension
          };
          
        case 'area':
          return {
            ...baseConfig,
            type: 'AreaChart',
            dataKey: primaryMeasure,
            xAxisKey: primaryDimension
          };
          
        case 'pie':
          return {
            ...baseConfig,
            type: 'PieChart',
            dataKey: primaryMeasure,
            nameKey: primaryDimension
          };
          
        case 'scatter':
          return {
            ...baseConfig,
            type: 'ScatterChart',
            dataKey: primaryMeasure,
            xAxisKey: primaryDimension
          };
          
        default:
          return baseConfig;
      }
    }
    
    applyFilters(data, filters) {
      if (!filters || Object.keys(filters).length === 0) {
        return data;
      }
      
      return data.filter(row => {
        return Object.keys(filters).every(filterKey => {
          const filterValues = filters[filterKey];
          
          // Skip if no filter values selected
          if (!filterValues || filterValues.length === 0) {
            return true;
          }
          
          const rowValue = row[filterKey];
          
          // Handle null/undefined values
          if (rowValue === null || rowValue === undefined) {
            return filterValues.includes('null') || filterValues.includes('undefined');
          }
          
          // Convert to string for comparison
          return filterValues.includes(String(rowValue));
        });
      });
    }
    
    getFilterOptions(data, schema) {
      const filterOptions = {};
      
      // Only create filters for dimensions (categorical data)
      schema.dimensions.forEach(dimension => {
        const values = [...new Set(
          data.map(row => row[dimension.name])
            .filter(val => val !== null && val !== undefined)
            .map(val => String(val))
        )].sort();
        
        // Only include dimensions with reasonable number of unique values
        if (values.length > 1 && values.length <= 50) {
          filterOptions[dimension.name] = {
            label: this.formatColumnName(dimension.name),
            options: values.map(value => ({
              label: value,
              value: value
            }))
          };
        }
      });
      
      return filterOptions;
    }
    
    formatColumnName(name) {
      return name
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Statistical calculations for advanced KPIs
    calculateStandardDeviation(data, column) {
      const values = data.map(row => parseFloat(row[column]) || 0);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
      return Math.sqrt(avgSquaredDiff);
    }
    
    calculateMedian(data, column) {
      const values = data.map(row => parseFloat(row[column]) || 0).sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    }
    
    calculatePercentile(data, column, percentile) {
      const values = data.map(row => parseFloat(row[column]) || 0).sort((a, b) => a - b);
      const index = (percentile / 100) * (values.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index % 1;
      
      if (lower === upper) {
        return values[lower];
      }
      
      return values[lower] * (1 - weight) + values[upper] * weight;
    }
    
    // Growth rate calculations
    calculateGrowthRate(data, dateColumn, valueColumn) {
      // Sort by date
      const sortedData = data
        .filter(row => row[dateColumn] && row[valueColumn])
        .sort((a, b) => new Date(a[dateColumn]) - new Date(b[dateColumn]));
      
      if (sortedData.length < 2) return 0;
      
      const firstValue = parseFloat(sortedData[0][valueColumn]);
      const lastValue = parseFloat(sortedData[sortedData.length - 1][valueColumn]);
      
      if (firstValue === 0) return 0;
      
      return ((lastValue - firstValue) / firstValue) * 100;
    }
    
    // Data quality assessment
    assessDataQuality(data, schema) {
      const quality = {
        completeness: {},
        consistency: {},
        validity: {},
        overall: 0
      };
      
      schema.columns.forEach(column => {
        const values = data.map(row => row[column.name]);
        const nonNullValues = values.filter(val => val !== null && val !== undefined && val !== '');
        
        quality.completeness[column.name] = (nonNullValues.length / data.length) * 100;
      });
      
      // Calculate overall quality score
      const completenessScores = Object.values(quality.completeness);
      quality.overall = completenessScores.reduce((sum, score) => sum + score, 0) / completenessScores.length;
      
      return quality;
    }



    // backend/services/calculator.js - Add these methods to existing Calculator class

// Add this method to the existing Calculator class

generateSingleChartConfig(data, schema, chartCombination) {
    try {
      console.log('📊 Generating single chart config for:', chartCombination);
      
      const chartData = this.prepareChartData(data, chartCombination);
      
      if (!chartData || chartData.length === 0) {
        throw new Error('No data available for chart generation');
      }
  
      const chartConfig = {
        id: chartCombination.id || `chart_${Date.now()}`,
        title: chartCombination.title || `${chartCombination.type.charAt(0).toUpperCase() + chartCombination.type.slice(1)} Chart`,
        type: chartCombination.type,
        data: chartData,
        measures: chartCombination.measures,
        dimensions: chartCombination.dimensions,
        config: this.generateChartOption(chartCombination.type, chartData, chartCombination.measures, chartCombination.dimensions),
        isCustom: chartCombination.isCustom || false,
        aiSuggestion: chartCombination.aiSuggestion,
        insights: chartCombination.insights || [],
        isAiGenerated: chartCombination.isAiGenerated || false
      };
  
      console.log('✅ Generated chart config:', chartConfig.title);
      return chartConfig;
  
    } catch (error) {
      console.error('❌ Error generating single chart config:', error);
      throw error;
    }
  }
  
  // Enhanced chart data preparation for custom combinations
  prepareCustomChartData(data, measures, dimensions, chartType) {
    try {
      console.log(`📈 Preparing custom chart data for ${chartType}:`, { measures, dimensions });
  
      if (!measures || measures.length === 0 || !dimensions || dimensions.length === 0) {
        throw new Error('Measures and dimensions are required');
      }
  
      const primaryDimension = dimensions[0];
      
      // Group data by primary dimension
      const grouped = this.groupByDimension(data, primaryDimension);
      
      // Calculate aggregated values for each group
      const chartData = Object.keys(grouped).map(key => {
        const group = grouped[key];
        const dataPoint = { [primaryDimension]: key };
        
        // Calculate values for each measure
        measures.forEach(measure => {
          const values = group.map(row => parseFloat(row[measure]) || 0);
          
          // Different aggregation strategies based on chart type
          switch (chartType) {
            case 'line':
            case 'area':
              // For time-series, use sum or average
              dataPoint[measure] = values.reduce((sum, val) => sum + val, 0);
              break;
            case 'pie':
              // For pie charts, use sum
              dataPoint[measure] = values.reduce((sum, val) => sum + val, 0);
              break;
            case 'scatter':
              // For scatter plots, use average
              dataPoint[measure] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
              break;
            default:
              // Default to sum
              dataPoint[measure] = values.reduce((sum, val) => sum + val, 0);
          }
        });
        
        return dataPoint;
      });
  
      // Sort data based on chart type requirements
      const sortedData = this.sortCustomChartData(chartData, measures[0], chartType, primaryDimension);
      
      console.log(`✅ Prepared ${sortedData.length} data points for ${chartType} chart`);
      return sortedData;
  
    } catch (error) {
      console.error('❌ Error preparing custom chart data:', error);
      throw error;
    }
  }
  
  sortCustomChartData(data, primaryMeasure, chartType, primaryDimension) {
    switch (chartType) {
      case 'pie':
        // Sort pie charts by value (descending) for better visual hierarchy
        return data.sort((a, b) => (b[primaryMeasure] || 0) - (a[primaryMeasure] || 0));
        
      case 'line':
      case 'area':
        // Sort line/area charts by dimension (usually for time-series or ordered data)
        return data.sort((a, b) => {
          const aVal = a[primaryDimension];
          const bVal = b[primaryDimension];
          
          // Try to sort numerically if possible, otherwise alphabetically
          if (!isNaN(aVal) && !isNaN(bVal)) {
            return parseFloat(aVal) - parseFloat(bVal);
          }
          
          // For date strings, try date parsing
          const aDate = new Date(aVal);
          const bDate = new Date(bVal);
          if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
            return aDate - bDate;
          }
          
          // Default to string comparison
          return String(aVal).localeCompare(String(bVal));
        });
        
      case 'bar':
      case 'scatter':
      default:
        // Sort bar charts by value (descending) for better readability
        return data.sort((a, b) => (b[primaryMeasure] || 0) - (a[primaryMeasure] || 0));
    }
  }
  
  // Enhanced chart option generation for custom charts
  generateCustomChartOption(type, data, measures, dimensions) {
    const primaryMeasure = measures[0];
    const primaryDimension = dimensions[0];
    
    const baseConfig = {
      data: data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    };
    
    switch (type) {
      case 'bar':
        return {
          ...baseConfig,
          type: 'BarChart',
          dataKey: primaryMeasure,
          xAxisKey: primaryDimension,
          bars: measures.map(measure => ({
            dataKey: measure,
            name: this.formatColumnName(measure),
            fill: this.getColorForMeasure(measure, measures)
          }))
        };
        
      case 'line':
        return {
          ...baseConfig,
          type: 'LineChart',
          dataKey: primaryMeasure,
          xAxisKey: primaryDimension,
          lines: measures.map(measure => ({
            dataKey: measure,
            name: this.formatColumnName(measure),
            stroke: this.getColorForMeasure(measure, measures)
          }))
        };
        
      case 'area':
        return {
          ...baseConfig,
          type: 'AreaChart',
          dataKey: primaryMeasure,
          xAxisKey: primaryDimension,
          areas: measures.map(measure => ({
            dataKey: measure,
            name: this.formatColumnName(measure),
            fill: this.getColorForMeasure(measure, measures)
          }))
        };
        
      case 'pie':
        return {
          ...baseConfig,
          type: 'PieChart',
          dataKey: primaryMeasure,
          nameKey: primaryDimension,
          showLabel: true,
          showLegend: true
        };
        
      case 'scatter':
        return {
          ...baseConfig,
          type: 'ScatterChart',
          dataKey: primaryMeasure,
          xAxisKey: primaryDimension,
          yAxisKey: measures[1] || primaryMeasure // Use second measure if available
        };
        
      default:
        return baseConfig;
    }
  }
  
  getColorForMeasure(measure, allMeasures) {
    const colors = ['#1890ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#eb2f96', '#13c2c2', '#a0d911'];
    const index = allMeasures.indexOf(measure);
    return colors[index % colors.length];
  }
  
  // Analyze chart combination effectiveness
  analyzeChartCombination(data, measures, dimensions, chartType) {
    const analysis = {
      dataPoints: data.length,
      effectiveness: 'medium',
      recommendations: [],
      warnings: []
    };
  
    // Analyze based on chart type and data characteristics
    switch (chartType) {
      case 'pie':
        const uniqueDimensions = new Set(data.map(row => row[dimensions[0]])).size;
        if (uniqueDimensions > 10) {
          analysis.warnings.push('Too many categories for pie chart - consider bar chart');
          analysis.effectiveness = 'low';
        } else if (uniqueDimensions <= 5) {
          analysis.effectiveness = 'high';
          analysis.recommendations.push('Perfect for showing proportional relationships');
        }
        break;
        
      case 'line':
        // Check if dimension is suitable for line chart (time-based or ordered)
        const isTimeOrOrdered = this.isTimeBasedDimension(data, dimensions[0]);
        if (isTimeOrOrdered) {
          analysis.effectiveness = 'high';
          analysis.recommendations.push('Excellent for showing trends over time');
        } else {
          analysis.warnings.push('Consider bar chart for non-temporal categorical data');
          analysis.effectiveness = 'medium';
        }
        break;
        
      case 'scatter':
        if (measures.length >= 2) {
          analysis.effectiveness = 'high';
          analysis.recommendations.push('Great for exploring correlations between measures');
        } else {
          analysis.warnings.push('Scatter plot works best with two numeric measures');
          analysis.effectiveness = 'low';
        }
        break;
        
      case 'bar':
        analysis.effectiveness = 'high';
        analysis.recommendations.push('Versatile chart type suitable for most categorical comparisons');
        break;
        
      case 'area':
        if (measures.length > 1) {
          analysis.effectiveness = 'high';
          analysis.recommendations.push('Great for showing cumulative values and part-to-whole relationships');
        } else {
          analysis.effectiveness = 'medium';
          analysis.recommendations.push('Consider adding more measures for better area chart utilization');
        }
        break;
    }
  
    // General data quality checks
    if (data.length < 3) {
      analysis.warnings.push('Very limited data points - results may not be meaningful');
      analysis.effectiveness = 'low';
    } else if (data.length > 50) {
      analysis.recommendations.push('Rich dataset - consider filtering for clearer visualization');
    }
  
    return analysis;
  }
  
  isTimeBasedDimension(data, dimension) {
    // Check if dimension values look like dates or have natural ordering
    const sampleValues = data.slice(0, 10).map(row => row[dimension]);
    
    // Check for date patterns
    const datePattern = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2}/;
    const dateCount = sampleValues.filter(val => datePattern.test(String(val))).length;
    
    if (dateCount > sampleValues.length * 0.5) {
      return true;
    }
    
    // Check for numeric ordering (years, months, etc.)
    const numericValues = sampleValues.map(val => parseFloat(val)).filter(val => !isNaN(val));
    if (numericValues.length === sampleValues.length) {
      return true; // All numeric values suggest ordering
    }
    
    return false;
  }
  
  // Validate custom chart configuration
  validateCustomChartConfig(measures, dimensions, chartType, data) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
  
    // Basic validation
    if (!measures || measures.length === 0) {
      validation.isValid = false;
      validation.errors.push('At least one measure is required');
    }
  
    if (!dimensions || dimensions.length === 0) {
      validation.isValid = false;
      validation.errors.push('At least one dimension is required');
    }
  
    if (!chartType || !['bar', 'line', 'pie', 'area', 'scatter'].includes(chartType)) {
      validation.isValid = false;
      validation.errors.push('Invalid chart type specified');
    }
  
    if (!data || data.length === 0) {
      validation.isValid = false;
      validation.errors.push('No data available for chart generation');
    }
  
    // Chart-specific validations
    if (validation.isValid) {
      switch (chartType) {
        case 'pie':
          if (measures.length > 1) {
            validation.warnings.push('Pie charts work best with a single measure');
            validation.suggestions.push('Consider using a bar chart for multiple measures');
          }
          
          const uniqueCategories = new Set(data.map(row => row[dimensions[0]])).size;
          if (uniqueCategories > 12) {
            validation.warnings.push('Too many categories for effective pie chart visualization');
            validation.suggestions.push('Consider filtering data or using a bar chart');
          }
          break;
  
        case 'scatter':
          if (measures.length < 2) {
            validation.warnings.push('Scatter plots are most effective with two measures');
            validation.suggestions.push('Add another measure for X-Y correlation analysis');
          }
          break;
  
        case 'line':
          const isOrdered = this.isTimeBasedDimension(data, dimensions[0]);
          if (!isOrdered) {
            validation.warnings.push('Line charts work best with time-based or ordered dimensions');
            validation.suggestions.push('Consider using a bar chart for categorical data');
          }
          break;
      }
    }
  
    return validation;
  }
  
  // Generate chart metadata for custom charts
  generateChartMetadata(measures, dimensions, chartType, data) {
    const metadata = {
      chartType,
      measures: measures.map(measure => ({
        name: measure,
        displayName: this.formatColumnName(measure),
        aggregation: 'sum',
        dataType: 'number'
      })),
      dimensions: dimensions.map(dimension => ({
        name: dimension,
        displayName: this.formatColumnName(dimension),
        cardinality: new Set(data.map(row => row[dimension])).size,
        dataType: this.inferDimensionType(data, dimension)
      })),
      dataPoints: data.length,
      createdAt: new Date().toISOString(),
      complexity: this.calculateChartComplexity(measures, dimensions, data),
      effectiveness: this.analyzeChartCombination(data, measures, dimensions, chartType)
    };
  
    return metadata;
  }
  
  inferDimensionType(data, dimension) {
    const sampleValues = data.slice(0, 10).map(row => row[dimension]);
    
    // Check for dates
    const datePattern = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/;
    if (sampleValues.some(val => datePattern.test(String(val)))) {
      return 'date';
    }
    
    // Check for numbers
    const numericCount = sampleValues.filter(val => !isNaN(parseFloat(val))).length;
    if (numericCount === sampleValues.length) {
      return 'number';
    }
    
    return 'string';
  }
  
  calculateChartComplexity(measures, dimensions, data) {
    let complexity = 1;
    
    // More measures increase complexity
    complexity += measures.length * 0.5;
    
    // More dimensions increase complexity
    complexity += dimensions.length * 0.3;
    
    // More data points increase complexity
    if (data.length > 100) complexity += 1;
    if (data.length > 500) complexity += 1;
    
    // High cardinality dimensions increase complexity
    dimensions.forEach(dimension => {
      const cardinality = new Set(data.map(row => row[dimension])).size;
      if (cardinality > 10) complexity += 0.5;
      if (cardinality > 50) complexity += 1;
    });
    
    // Classify complexity
    if (complexity <= 2) return 'low';
    if (complexity <= 4) return 'medium';
    return 'high';
  }
  
  }
  
  module.exports = new Calculator();