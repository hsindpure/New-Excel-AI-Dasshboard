// frontend/src/components/Dashboard.js - Enhanced for large datasets
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Layout, 
  Typography, 
  Button, 
  Row, 
  Col, 
  Card, 
  Space, 
  Statistic, 
  Switch,
  Spin,
  Alert,
  Drawer,
  Tag,
  message,
  Popover,
  Divider,
  Progress
} from 'antd';
import { 
  ArrowLeftOutlined, 
  FilterOutlined, 
  DownloadOutlined,
  ReloadOutlined,
  SettingOutlined,
  SunOutlined,
  MoonOutlined,
  BarChartOutlined,
  FileAddOutlined,
  InfoCircleOutlined,
  CalculatorOutlined,
  DatabaseOutlined,
  FunctionOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  ClearOutlined
} from '@ant-design/icons';
import ChartContainer from './ChartContainer';
import FilterSidebar from './FilterSidebar';
import CustomizeSidebar from './CustomizeSidebar';
import { generateDashboard, suggestCharts, addCustomChart, getSession } from '../services/api';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const Dashboard = ({ sessionId, fileInfo, onBack, onNewFile, onToggleTheme, isDarkMode }) => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [activeFilters, setActiveFilters] = useState({});
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [customizeDrawerVisible, setCustomizeDrawerVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [chartsUpdating, setChartsUpdating] = useState(false);
  
  // New state for data limit control
  const [dataLimit, setDataLimit] = useState(null);
  const [performanceMode, setPerformanceMode] = useState(false);
  
  // Add state for managing closed charts
  const [closedCharts, setClosedCharts] = useState(new Set());

  const handleChartClose = useCallback((chartId) => {
    setClosedCharts(prev => new Set([...prev, chartId]));
    message.success('Chart removed from view');
  }, []);

  const handleRestoreAllCharts = useCallback(() => {
    setClosedCharts(new Set());
    message.success('All charts restored');
  }, []);

  // Filter and sort charts: custom charts first, then filter out closed charts
  const visibleCharts = useMemo(() => {
    if (!dashboardData?.charts) return [];
    
    // Separate custom and default charts
    const customCharts = dashboardData.charts.filter(chart => chart.isCustom);
    const defaultCharts = dashboardData.charts.filter(chart => !chart.isCustom);
    
    // Combine with custom charts first, then filter out closed charts
    const allCharts = [...customCharts, ...defaultCharts];
    
    return allCharts.filter(chart => !closedCharts.has(chart.id));
  }, [dashboardData?.charts, closedCharts]);

  useEffect(() => {
    if (sessionId) {
      loadInitialDashboard();
      loadSessionData();
    }
  }, [sessionId]);

  // Detect large datasets and suggest performance mode
  useEffect(() => {
    if (sessionData && sessionData.stats?.isLargeDataset && !performanceMode) {
      setPerformanceMode(true);
      setDataLimit(1000); // Default to 1000 for large datasets
      
      message.warning({
        content: 'Large dataset detected. Performance mode enabled with 1,000 record limit.',
        duration: 5
      });
    }
  }, [sessionData, performanceMode]);

  const loadSessionData = useCallback(async () => {
    try {
      const result = await getSession(sessionId);
      setSessionData(result.data);
      
      // Set initial data limit based on dataset size
      if (result.data.performance?.recommendedDataLimit) {
        setDataLimit(result.data.performance.recommendedDataLimit);
      }
      
    } catch (error) {
      console.error('Session data loading error:', error);
    }
  }, [sessionId]);

  const loadInitialDashboard = useCallback(async () => {
    try {
      setInitialLoading(true);
      setError(null);

      // Use default data limit for initial load if large dataset
      const initialDataLimit = fileInfo?.isLargeDataset ? 1000 : null;
      
      // Use modified generateDashboard function with includeCustomCharts parameter
      const result = await generateDashboard(sessionId, {}, null, null, initialDataLimit, true);
      
      setDashboardData(result.dashboard);
      setActiveFilters({});
      
      if (initialDataLimit) {
        setDataLimit(initialDataLimit);
        message.info(`Dashboard loaded with ${initialDataLimit.toLocaleString()} record limit for optimal performance`);
      } else {
        message.success('Dashboard loaded successfully!');
      }

    } catch (error) {
      setError(error.message || 'Failed to load dashboard');
      message.error('Failed to load dashboard: ' + error.message);
    } finally {
      setInitialLoading(false);
    }
  }, [sessionId, fileInfo]);

  const updateDashboardWithFilters = useCallback(async (filters, newDataLimit = dataLimit) => {
    try {
      setChartsUpdating(true);
      
      // Use the modified generateDashboard function with includeCustomCharts parameter
      const result = await generateDashboard(sessionId, filters, null, null, newDataLimit, true);
      
      setDashboardData(prevData => ({
        ...prevData,
        kpis: result.dashboard.kpis,
        charts: result.dashboard.charts, // This now includes both default and custom charts
        dataCount: result.dashboard.dataCount,
        activeFilters: filters,
        performance: result.dashboard.performance
      }));
      
      setActiveFilters(filters);

      const filterCount = Object.keys(filters).length;
      if (filterCount > 0) {
        message.success(`Applied ${filterCount} filter${filterCount !== 1 ? 's' : ''}`);
      } else {
        message.success('Filters cleared');
      }

    } catch (error) {
      message.error('Failed to apply filters');
    } finally {
      setChartsUpdating(false);
    }
  }, [sessionId, dataLimit]);

  const handleDataLimitChange = useCallback(async (newDataLimit) => {
    try {
      setChartsUpdating(true);
      setDataLimit(newDataLimit);
      
      // Update dashboard with new data limit
      await updateDashboardWithFilters(activeFilters, newDataLimit);
      
      // Update performance mode based on limit
      setPerformanceMode(newDataLimit !== null && newDataLimit <= 10000);
      
    } catch (error) {
      message.error('Failed to update data limit');
    }
  }, [activeFilters, updateDashboardWithFilters]);

  const handleFilterChange = useCallback(async (newFilters) => {
    await updateDashboardWithFilters(newFilters);
  }, [updateDashboardWithFilters]);

  const handleCustomize = async () => {
    try {
      setCustomizing(true);
      setCustomizeDrawerVisible(true);
    } catch (error) {
      message.error('Failed to open customization panel');
    } finally {
      setCustomizing(false);
    }
  };

  const handleChartConfirm = useCallback(async (chartCombination) => {
    try {
      const result = await addCustomChart(sessionId, chartCombination, activeFilters, dataLimit);
      
      if (result.success) {
        setDashboardData(prevData => ({
          ...prevData,
          charts: [...(prevData.charts || []), result.chart]
        }));
        
        message.success('Custom chart added successfully!');
      } else {
        throw new Error(result.message || 'Failed to add custom chart');
      }
      
    } catch (error) {
      message.error('Failed to add custom chart: ' + error.message);
      throw error;
    }
  }, [sessionId, activeFilters, dataLimit]);

  const toggleFilterDrawer = useCallback(() => {
    setFilterDrawerVisible(prev => !prev);
  }, []);

  const closeFilterDrawer = useCallback(() => {
    setFilterDrawerVisible(false);
  }, []);

  const toggleCustomizeDrawer = useCallback(() => {
    setCustomizeDrawerVisible(prev => !prev);
  }, []);

  const closeCustomizeDrawer = useCallback(() => {
    setCustomizeDrawerVisible(false);
  }, []);

  const exportDashboard = () => {
    try {
      const exportData = {
        ...dashboardData,
        metadata: {
          exportDate: new Date().toISOString(),
          fileName: fileInfo?.fileName,
          dataLimit: dataLimit,
          performanceMode: performanceMode,
          totalRecords: dashboardData?.performance?.totalRecords
        }
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-${fileInfo?.fileName}-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      message.success('Dashboard exported successfully!');
    } catch (error) {
      message.error('Failed to export dashboard');
    }
  };

  // Performance indicators
  const performanceInfo = useMemo(() => {
    if (!dashboardData?.performance) return null;
    
    const { totalRecords, displayedRecords, isLimited, isLargeDataset } = dashboardData.performance;
    
    return {
      totalRecords,
      displayedRecords,
      isLimited,
      isLargeDataset,
      filteredRecords: dashboardData.dataCount,
      performanceMode
    };
  }, [dashboardData, performanceMode]);

  // Generate KPI info tooltip content with performance info
  const getKPITooltipContent = (kpi) => {
    const calculationTypes = {
      sum: {
        icon: <FunctionOutlined style={{ color: '#1890ff' }} />,
        title: 'Sum Calculation',
        description: 'Adds up all values in the column',
        formula: 'Σ(values)',
      },
      count: {
        icon: <DatabaseOutlined style={{ color: '#52c41a' }} />,
        title: 'Count Calculation',
        description: 'Counts the number of records',
        formula: 'COUNT(records)',
      },
      avg: {
        icon: <CalculatorOutlined style={{ color: '#fa8c16' }} />,
        title: 'Average Calculation',
        description: 'Calculates the mean value',
        formula: 'Σ(values) / COUNT(values)',
      },
      max: {
        icon: <FunctionOutlined style={{ color: '#f5222d' }} />,
        title: 'Maximum Calculation',
        description: 'Finds the highest value',
        formula: 'MAX(values)',
      },
      min: {
        icon: <FunctionOutlined style={{ color: '#722ed1' }} />,
        title: 'Minimum Calculation',
        description: 'Finds the lowest value',
        formula: 'MIN(values)',
      }
    };

    const calc = calculationTypes[kpi.calculation] || calculationTypes.sum;
    const activeFilterCount = Object.keys(activeFilters).length;

    return (
      <div style={{ 
        maxWidth: '320px',
        background: isDarkMode ? '#262626' : '#fff',
        color: isDarkMode ? '#fff' : '#000'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: `1px solid ${isDarkMode ? '#434343' : '#f0f0f0'}`
        }}>
          {calc.icon}
          <Title level={5} style={{ 
            margin: '0 0 0 8px', 
            color: isDarkMode ? '#fff' : '#000' 
          }}>
            {calc.title}
          </Title>
        </div>

        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div>
            <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
              Description:
            </Text>
            <br />
            <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
              {calc.description}
            </Text>
          </div>

          <div>
            <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
              Column:
            </Text>
            <br />
            <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
              {kpi.column === '*' ? 'All records' : kpi.column}
            </Text>
          </div>

          <div>
            <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
              Current Value:
            </Text>
            <br />
            <Text style={{ 
              color: '#1890ff',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              {kpi.formattedValue}
            </Text>
          </div>

          {/* Performance Information */}
          {(kpi.dataPoints || kpi.isLimited) && (
            <div>
              <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                Data Points:
              </Text>
              <br />
              <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
                {kpi.dataPoints?.toLocaleString()} records
                {kpi.isLimited && (
                  <span style={{ color: '#fa8c16' }}> (limited for performance)</span>
                )}
              </Text>
            </div>
          )}

          {activeFilterCount > 0 && (
            <div>
              <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                Applied Filters:
              </Text>
              <br />
              <Text style={{ color: '#fa8c16', fontSize: '12px' }}>
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
              </Text>
            </div>
          )}
        </Space>
      </div>
    );
  };

  // Show initial loading screen
  if (initialLoading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: isDarkMode ? '#141414' : '#f0f2f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <Title level={4} style={{ marginTop: '16px', color: isDarkMode ? '#fff' : '#000' }}>
            Generating your AI dashboard...
          </Title>
          <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
            {fileInfo?.isLargeDataset ? 
              'Optimizing for large dataset performance...' : 
              'AI is analyzing your data and creating intelligent insights'
            }
          </Text>
          {fileInfo?.isLargeDataset && (
            <div style={{ marginTop: '16px' }}>
              <Progress percent={75} size="small" />
              <Text style={{ fontSize: '12px', color: isDarkMode ? '#a0a0a0' : '#666' }}>
                Large dataset detected - applying performance optimizations
              </Text>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: isDarkMode ? '#141414' : '#f0f2f5',
        padding: '24px'
      }}>
        <Alert
          message="Dashboard Error"
          description={error}
          type="error"
          showIcon
          style={{ maxWidth: '600px' }}
          action={
            <Space>
              <Button size="small" onClick={loadInitialDashboard}>
                Retry
              </Button>
              <Button size="small" onClick={onBack}>
                Back to Upload
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  const activeFilterCount = Object.keys(activeFilters).length;

  return (
    <Layout style={{ minHeight: '100vh', background: isDarkMode ? '#141414' : '#f0f2f5' }}>
      {/* Header */}
      <Header style={{ 
        background: isDarkMode ? '#001529' : '#fff',
        borderBottom: `1px solid ${isDarkMode ? '#434343' : '#f0f0f0'}`,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={onBack}
            style={{ color: isDarkMode ? '#fff' : '#000' }}
          >
            Back
          </Button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BarChartOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <div>
              <Title level={4} style={{ margin: 0, color: isDarkMode ? '#fff' : '#000' }}>
                {fileInfo?.fileName || 'AI Dashboard'}
              </Title>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Text style={{ fontSize: '12px', color: isDarkMode ? '#a0a0a0' : '#666' }}>
                  {performanceInfo ? (
                    <>
                      {performanceInfo.totalRecords?.toLocaleString()} total
                      {performanceInfo.isLimited && (
                        <> • {performanceInfo.displayedRecords?.toLocaleString()} displayed</>
                      )}
                      {performanceInfo.filteredRecords !== performanceInfo.totalRecords && (
                        <> • {performanceInfo.filteredRecords?.toLocaleString()} filtered</>
                      )}
                      {dashboardData?.charts && (
                        <> • {visibleCharts.length}/{dashboardData.charts.length} charts</>
                      )}
                    </>
                  ) : (
                    'Loading...'
                  )}
                  {chartsUpdating && <span style={{ color: '#1890ff' }}> • Updating...</span>}
                </Text>
                
                {performanceInfo?.isLargeDataset && (
                  <Tag color="orange" size="small">
                    <DatabaseOutlined style={{ marginRight: '2px' }} />
                    Large Dataset
                  </Tag>
                )}
                
                {performanceMode && (
                  <Tag color="green" size="small">
                    <ThunderboltOutlined style={{ marginRight: '2px' }} />
                    Performance Mode
                  </Tag>
                )}
              </div>
            </div>
          </div>
        </div>

        <Space>
          <Button 
            icon={<FilterOutlined />}
            onClick={toggleFilterDrawer}
            type={activeFilterCount > 0 ? 'primary' : 'default'}
            style={{ position: 'relative' }}
          >
            Filters
            {activeFilterCount > 0 && (
              <Tag 
                color="blue" 
                style={{ 
                  marginLeft: '4px',
                  minWidth: '20px',
                  textAlign: 'center'
                }}
              >
                {activeFilterCount}
              </Tag>
            )}
          </Button>
          
          <Button 
            icon={<ExperimentOutlined />}
            onClick={handleCustomize}
            loading={customizing}
            type={customizeDrawerVisible ? 'primary' : 'default'}
          >
            Customize
          </Button>
          
          <Button 
            icon={<DownloadOutlined />}
            onClick={exportDashboard}
          >
            Export
          </Button>
          
          <Button 
            icon={<FileAddOutlined />}
            onClick={onNewFile}
            type="primary"
          >
            New File
          </Button>

          <div style={{ 
            borderLeft: `1px solid ${isDarkMode ? '#434343' : '#f0f0f0'}`, 
            paddingLeft: '16px',
            marginLeft: '8px'
          }}>
            <Space>
              <SunOutlined style={{ color: isDarkMode ? '#fff' : '#000' }} />
              <Switch checked={isDarkMode} onChange={onToggleTheme} />
              <MoonOutlined style={{ color: isDarkMode ? '#fff' : '#000' }} />
            </Space>
          </div>
        </Space>
      </Header>

      {/* Content */}
      <Content style={{ padding: '24px', overflow: 'auto' }}>
        {/* Performance Alert for Large Datasets */}
        {performanceInfo?.isLargeDataset && !performanceMode && (
          <Alert
            message="Large Dataset Detected"
            description={
              <div>
                <p>Your dataset contains {performanceInfo.totalRecords?.toLocaleString()} records. For optimal performance:</p>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Use data limits to display fewer records</li>
                  <li>Apply filters to reduce data size</li>
                  <li>Enable performance mode for better responsiveness</li>
                </ul>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: '24px' }}
            action={
              <Button 
                size="small" 
                type="primary"
                onClick={() => {
                  setPerformanceMode(true);
                  setDataLimit(1000);
                  handleDataLimitChange(1000);
                }}
              >
                Enable Performance Mode
              </Button>
            }
          />
        )}

        {/* KPI Cards with Performance Info */}
        {dashboardData?.kpis && dashboardData.kpis.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            {dashboardData.kpis.map((kpi, index) => (
              <Col xs={24} sm={12} lg={6} key={index}>
                <Card 
                  size="small"
                  style={{ 
                    background: isDarkMode ? '#1f1f1f' : '#fff',
                    borderColor: isDarkMode ? '#434343' : '#f0f0f0',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  hoverable
                >
                  {chartsUpdating && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(24, 144, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1
                    }}>
                      <Spin size="small" />
                    </div>
                  )}
                  
                  <Statistic
                    title={
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between' 
                      }}>
                        <span style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
                          {kpi.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {kpi.isLimited && (
                            <Tag color="orange" size="small" style={{ fontSize: '10px' }}>
                              Limited
                            </Tag>
                          )}
                          <Popover
                            content={getKPITooltipContent(kpi)}
                            title={
                              <span style={{ color: isDarkMode ? '#fff' : '#000' }}>
                                <InfoCircleOutlined style={{ marginRight: '8px' }} />
                                KPI Details
                              </span>
                            }
                            trigger="hover"
                            placement="topRight"
                            overlayStyle={{ maxWidth: '350px' }}
                          >
                            <InfoCircleOutlined 
                              style={{ 
                                color: isDarkMode ? '#a0a0a0' : '#999',
                                fontSize: '14px',
                                cursor: 'help'
                              }}
                            />
                          </Popover>
                        </div>
                      </div>
                    }
                    value={kpi.formattedValue}
                    valueStyle={{ 
                      color: isDarkMode ? '#fff' : '#000',
                      fontSize: '24px',
                      fontWeight: 'bold'
                    }}
                  />
                  
                  {kpi.dataPoints && (
                    <div style={{ 
                      fontSize: '11px', 
                      color: isDarkMode ? '#a0a0a0' : '#999',
                      marginTop: '4px'
                    }}>
                      Based on {kpi.dataPoints.toLocaleString()} records
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Charts Grid */}
        {visibleCharts && visibleCharts.length > 0 && (
          <>
            {/* Restore button if any charts are closed */}
            {closedCharts.size > 0 && (
              <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <Alert
                  message={`${closedCharts.size} chart${closedCharts.size !== 1 ? 's' : ''} hidden`}
                  type="info"
                  showIcon
                  action={
                    <Button size="small" onClick={handleRestoreAllCharts}>
                      Restore All Charts
                    </Button>
                  }
                  style={{ marginBottom: '16px' }}
                />
              </div>
            )}
            
            <Row gutter={[16, 16]}>
              {visibleCharts.map((chart, index) => (
                <Col xs={24} lg={12} key={chart.id || index}>
                  <Card 
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: isDarkMode ? '#fff' : '#000' }}>
                          {chart.title}
                        </span>
                        {chart.isCustom && (
                          <Tag color="orange" size="small">
                            Custom
                          </Tag>
                        )}
                        {chart.isAiGenerated && (
                          <Tag color="green" size="small">
                            AI
                          </Tag>
                        )}
                        {chart.isLimited && (
                          <Tag color="blue" size="small">
                            Limited
                          </Tag>
                        )}
                        {chart.optimizedForLargeData && (
                          <Tag color="purple" size="small">
                            Optimized
                          </Tag>
                        )}
                      </div>
                    }
                    extra={
                      <Space>
                        <Button 
                          type="text" 
                          icon={<ReloadOutlined />}
                          size="small"
                          onClick={() => updateDashboardWithFilters(activeFilters)}
                          style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}
                          title="Refresh chart"
                        />
                        <Button 
                          type="text" 
                          icon={<ClearOutlined />}
                          size="small"
                          onClick={() => handleChartClose(chart.id)}
                          style={{ color: '#ff4d4f' }}
                          title="Remove chart"
                        />
                      </Space>
                    }
                    style={{ 
                      background: isDarkMode ? '#1f1f1f' : '#fff',
                      borderColor: isDarkMode ? '#434343' : '#f0f0f0',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      // Highlight custom charts with subtle border
                      ...(chart.isCustom && {
                        borderLeft: `4px solid #fa8c16`,
                        borderLeftWidth: '4px'
                      })
                    }}
                    headStyle={{ 
                      background: isDarkMode ? '#262626' : '#fafafa',
                      borderBottomColor: isDarkMode ? '#434343' : '#f0f0f0'
                    }}
                    bodyStyle={{ padding: '16px', position: 'relative' }}
                    hoverable
                  >
                    {chartsUpdating && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(24, 144, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                        borderRadius: '6px'
                      }}>
                        <Spin size="default" />
                      </div>
                    )}
                    
                    <ChartContainer 
                      chart={chart} 
                      isDarkMode={isDarkMode}
                      height={300}
                      updating={chartsUpdating}
                    />
                    
                    {/* Chart performance info */}
                    {chart.dataPoints && (
                      <div style={{ 
                        fontSize: '11px', 
                        color: isDarkMode ? '#a0a0a0' : '#999',
                        marginTop: '8px',
                        textAlign: 'center',
                        borderTop: `1px solid ${isDarkMode ? '#434343' : '#f0f0f0'}`,
                        paddingTop: '8px'
                      }}>
                        Chart data: {chart.dataPoints.toLocaleString()} records
                        {chart.isLimited && (
                          <span style={{ color: '#fa8c16' }}> (performance limited)</span>
                        )}
                        {chart.isCustom && (
                          <span style={{ color: '#fa8c16' }}> • Custom Generated</span>
                        )}
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        )}

        {/* Empty State */}
        {(!visibleCharts || visibleCharts.length === 0) && (
          <Card style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            background: isDarkMode ? '#1f1f1f' : '#fff',
            borderColor: isDarkMode ? '#434343' : '#f0f0f0'
          }}>
            <BarChartOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
            <Title level={4} style={{ color: isDarkMode ? '#fff' : '#000' }}>
              {closedCharts.size > 0 ? 'All charts are hidden' : 'No charts available'}
            </Title>
            <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
              {closedCharts.size > 0 
                ? 'All charts have been removed from view. Restore them or create new ones.'
                : 'Try adjusting your filters, increasing data limits, or use the customize feature'
              }
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Space>
                {closedCharts.size > 0 && (
                  <Button 
                    type="primary" 
                    icon={<ReloadOutlined />}
                    onClick={handleRestoreAllCharts}
                  >
                    Restore All Charts
                  </Button>
                )}
                <Button 
                  type="primary" 
                  icon={<ExperimentOutlined />}
                  onClick={handleCustomize}
                >
                  Customize Dashboard
                </Button>
                <Button 
                  icon={<FilterOutlined />}
                  onClick={toggleFilterDrawer}
                >
                  Adjust Filters
                </Button>
              </Space>
            </div>
          </Card>
        )}
      </Content>

      {/* Filter Sidebar */}
      <Drawer
        title={
          <span style={{ color: isDarkMode ? '#fff' : '#000' }}>
            <FilterOutlined style={{ marginRight: '8px' }} />
            Filters & Performance
          </span>
        }
        placement="right"
        width={400}
        onClose={closeFilterDrawer}
        open={filterDrawerVisible}
        bodyStyle={{ 
          background: isDarkMode ? '#1f1f1f' : '#fff',
          padding: 0
        }}
        headerStyle={{ 
          background: isDarkMode ? '#262626' : '#fafafa',
          borderBottomColor: isDarkMode ? '#434343' : '#f0f0f0'
        }}
        destroyOnClose={false}
        mask={true}
        maskClosable={true}
      >
        {filterDrawerVisible && dashboardData?.filterOptions && (
          <FilterSidebar
            filterOptions={dashboardData.filterOptions}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            isDarkMode={isDarkMode}
            dataLimit={dataLimit}
            onDataLimitChange={handleDataLimitChange}
            performanceInfo={performanceInfo}
          />
        )}
      </Drawer>

      {/* Customize Sidebar */}
      <Drawer
        title={
          <span style={{ color: isDarkMode ? '#fff' : '#000' }}>
            <ExperimentOutlined style={{ marginRight: '8px' }} />
            Customize Dashboard
          </span>
        }
        placement="right"
        width={500}
        onClose={closeCustomizeDrawer}
        open={customizeDrawerVisible}
        bodyStyle={{ 
          background: isDarkMode ? '#1f1f1f' : '#fff',
          padding: 0
        }}
        headerStyle={{ 
          background: isDarkMode ? '#262626' : '#fafafa',
          borderBottomColor: isDarkMode ? '#434343' : '#f0f0f0'
        }}
        destroyOnClose={false}
        mask={true}
        maskClosable={true}
      >
        {customizeDrawerVisible && sessionData && (
          <CustomizeSidebar
            sessionId={sessionId}
            schema={sessionData.schema}
            onChartConfirm={handleChartConfirm}
            isDarkMode={isDarkMode}
            activeFilters={activeFilters}
            dataLimit={dataLimit}
            performanceInfo={performanceInfo}
          />
        )}
      </Drawer>
    </Layout>
  );
};

export default Dashboard;