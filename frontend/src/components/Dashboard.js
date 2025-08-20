// frontend/src/components/Dashboard.js
import React, { useState, useEffect, useCallback } from 'react';
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
  Divider
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
  ExperimentOutlined
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

  useEffect(() => {
    if (sessionId) {
      loadInitialDashboard();
      loadSessionData();
    }
  }, [sessionId]);

  const loadSessionData = useCallback(async () => {
    try {
      console.log('📊 Loading session data for:', sessionId);
      const result = await getSession(sessionId);
      setSessionData(result.data);
      console.log('✅ Session data loaded:', result.data);
    } catch (error) {
      console.error('❌ Session data loading error:', error);
    }
  }, [sessionId]);

  const loadInitialDashboard = useCallback(async () => {
    try {
      setInitialLoading(true);
      setError(null);

      console.log('📊 Loading initial dashboard for session:', sessionId);

      const result = await generateDashboard(sessionId, {});
      
      console.log('✅ Initial dashboard data received:', result.dashboard);
      
      setDashboardData(result.dashboard);
      setActiveFilters({});

      message.success('Dashboard loaded successfully!');

    } catch (error) {
      console.error('❌ Initial dashboard loading error:', error);
      setError(error.message || 'Failed to load dashboard');
      message.error('Failed to load dashboard: ' + error.message);
    } finally {
      setInitialLoading(false);
    }
  }, [sessionId]);

  const updateDashboardWithFilters = useCallback(async (filters) => {
    try {
      setChartsUpdating(true);
      console.log('🔍 Updating charts with filters:', JSON.stringify(filters, null, 2));

      const result = await generateDashboard(sessionId, filters);
      
      console.log('✅ Filtered dashboard data received:', result.dashboard);
      
      // Update dashboard data smoothly without full page reload
      setDashboardData(prevData => ({
        ...prevData,
        kpis: result.dashboard.kpis,
        charts: result.dashboard.charts,
        dataCount: result.dashboard.dataCount,
        activeFilters: filters
      }));
      
      setActiveFilters(filters);

      // Show subtle success message
      const filterCount = Object.keys(filters).length;
      if (filterCount > 0) {
        message.success(`Applied ${filterCount} filter${filterCount !== 1 ? 's' : ''}`);
      } else {
        message.success('Filters cleared');
      }

    } catch (error) {
      console.error('❌ Filter update error:', error);
      message.error('Failed to apply filters');
    } finally {
      setChartsUpdating(false);
    }
  }, [sessionId]);

  const handleFilterChange = useCallback(async (newFilters) => {
    console.log('🔍 Filter change received in Dashboard:', newFilters);
    await updateDashboardWithFilters(newFilters);
  }, [updateDashboardWithFilters]);

  const handleCustomize = async () => {
    try {
      setCustomizing(true);
      console.log('⚙️ Opening customize sidebar...');
      
      setCustomizeDrawerVisible(true);
      
    } catch (error) {
      console.error('❌ Customization error:', error);
      message.error('Failed to open customization panel');
    } finally {
      setCustomizing(false);
    }
  };

  const handleChartConfirm = useCallback(async (chartCombination) => {
    try {
      console.log('✅ Confirming custom chart:', chartCombination);
      
      // Add custom chart to dashboard
      const result = await addCustomChart(sessionId, chartCombination, activeFilters);
      
      if (result.success) {
        // Update dashboard with new custom chart
        setDashboardData(prevData => ({
          ...prevData,
          charts: [...(prevData.charts || []), result.chart]
        }));
        
        message.success('Custom chart added successfully!');
      } else {
        throw new Error(result.message || 'Failed to add custom chart');
      }
      
    } catch (error) {
      console.error('❌ Chart confirm error:', error);
      message.error('Failed to add custom chart: ' + error.message);
      throw error;
    }
  }, [sessionId, activeFilters]);

  const toggleFilterDrawer = useCallback(() => {
    console.log('🎛️ Toggling filter drawer. Current state:', filterDrawerVisible);
    setFilterDrawerVisible(prev => !prev);
  }, [filterDrawerVisible]);

  const closeFilterDrawer = useCallback(() => {
    console.log('❌ Closing filter drawer');
    setFilterDrawerVisible(false);
  }, []);

  const toggleCustomizeDrawer = useCallback(() => {
    console.log('🎨 Toggling customize drawer. Current state:', customizeDrawerVisible);
    setCustomizeDrawerVisible(prev => !prev);
  }, [customizeDrawerVisible]);

  const closeCustomizeDrawer = useCallback(() => {
    console.log('❌ Closing customize drawer');
    setCustomizeDrawerVisible(false);
  }, []);

  const exportDashboard = () => {
    try {
      console.log('📤 Exporting dashboard...');
      const dataStr = JSON.stringify(dashboardData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-${fileInfo?.fileName}-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      message.success('Dashboard exported successfully!');
    } catch (error) {
      console.error('❌ Export error:', error);
      message.error('Failed to export dashboard');
    }
  };

  // Generate KPI info tooltip content
  const getKPITooltipContent = (kpi) => {
    const calculationTypes = {
      sum: {
        icon: <FunctionOutlined style={{ color: '#1890ff' }} />,
        title: 'Sum Calculation',
        description: 'Adds up all values in the column',
        formula: 'Σ(values)',
        example: 'Example: 100 + 200 + 300 = 600'
      },
      count: {
        icon: <DatabaseOutlined style={{ color: '#52c41a' }} />,
        title: 'Count Calculation',
        description: 'Counts the number of records',
        formula: 'COUNT(records)',
        example: 'Example: Total number of rows in dataset'
      },
      avg: {
        icon: <CalculatorOutlined style={{ color: '#fa8c16' }} />,
        title: 'Average Calculation',
        description: 'Calculates the mean value',
        formula: 'Σ(values) / COUNT(values)',
        example: 'Example: (100 + 200 + 300) / 3 = 200'
      },
      max: {
        icon: <FunctionOutlined style={{ color: '#f5222d' }} />,
        title: 'Maximum Calculation',
        description: 'Finds the highest value',
        formula: 'MAX(values)',
        example: 'Example: MAX(100, 200, 300) = 300'
      },
      min: {
        icon: <FunctionOutlined style={{ color: '#722ed1' }} />,
        title: 'Minimum Calculation',
        description: 'Finds the lowest value',
        formula: 'MIN(values)',
        example: 'Example: MIN(100, 200, 300) = 100'
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
              Formula:
            </Text>
            <br />
            <Text code style={{ 
              background: isDarkMode ? '#1f1f1f' : '#f6f8fa',
              color: isDarkMode ? '#87d068' : '#d73a49',
              padding: '2px 6px',
              borderRadius: '3px'
            }}>
              {calc.formula}
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

          {activeFilterCount > 0 && (
            <div>
              <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                Applied Filters:
              </Text>
              <br />
              <Text style={{ color: '#fa8c16', fontSize: '12px' }}>
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active - showing filtered results
              </Text>
            </div>
          )}

          <Divider style={{ margin: '8px 0', borderColor: isDarkMode ? '#434343' : '#f0f0f0' }} />
          
          <Text style={{ 
            fontSize: '12px', 
            color: isDarkMode ? '#a0a0a0' : '#666',
            fontStyle: 'italic'
          }}>
            {calc.example}
          </Text>
        </Space>
      </div>
    );
  };

  // Show initial loading screen only on first load
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
            AI is analyzing your data and creating intelligent insights
          </Text>
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
        zIndex: 1000,
        lineHeight : "1px"
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
              <Text style={{ fontSize: '12px', color: isDarkMode ? '#a0a0a0' : '#666' }}>
                {dashboardData?.totalCount} records • {dashboardData?.dataCount} filtered
                {chartsUpdating && <span style={{ color: '#1890ff' }}> • Updating...</span>}
              </Text>
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
        {/* KPI Cards with Info Tooltips */}
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
                  {/* Subtle loading overlay for KPIs */}
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
                        <Popover
                          content={getKPITooltipContent(kpi)}
                          title={
                            <span style={{ color: isDarkMode ? '#fff' : '#000' }}>
                              <InfoCircleOutlined style={{ marginRight: '8px' }} />
                              KPI Calculation Details
                            </span>
                          }
                          trigger="hover"
                          placement="topRight"
                          overlayStyle={{ maxWidth: '350px' }}
                          overlayInnerStyle={{
                            background: isDarkMode ? '#262626' : '#fff',
                            color: isDarkMode ? '#fff' : '#000'
                          }}
                        >
                          <InfoCircleOutlined 
                            style={{ 
                              color: isDarkMode ? '#a0a0a0' : '#999',
                              fontSize: '14px',
                              cursor: 'help',
                              transition: 'color 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.color = '#1890ff';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.color = isDarkMode ? '#a0a0a0' : '#999';
                            }}
                          />
                        </Popover>
                      </div>
                    }
                    value={kpi.formattedValue}
                    valueStyle={{ 
                      color: isDarkMode ? '#fff' : '#000',
                      fontSize: '24px',
                      fontWeight: 'bold'
                    }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Charts Grid */}
        {dashboardData?.charts && dashboardData.charts.length > 0 && (
          <Row gutter={[16, 16]}>
            {dashboardData.charts.map((chart, index) => (
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
                    </div>
                  }
                  extra={
                    <Button 
                      type="text" 
                      icon={<ReloadOutlined />}
                      size="small"
                      onClick={() => updateDashboardWithFilters(activeFilters)}
                      style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}
                    />
                  }
                  style={{ 
                    background: isDarkMode ? '#1f1f1f' : '#fff',
                    borderColor: isDarkMode ? '#434343' : '#f0f0f0',
                    transition: 'all 0.3s ease',
                    position: 'relative'
                  }}
                  headStyle={{ 
                    background: isDarkMode ? '#262626' : '#fafafa',
                    borderBottomColor: isDarkMode ? '#434343' : '#f0f0f0'
                  }}
                  bodyStyle={{ padding: '16px', position: 'relative' }}
                  hoverable
                >
                  {/* Subtle loading overlay for individual charts */}
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
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Empty State */}
        {(!dashboardData?.charts || dashboardData.charts.length === 0) && (
          <Card style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            background: isDarkMode ? '#1f1f1f' : '#fff',
            borderColor: isDarkMode ? '#434343' : '#f0f0f0'
          }}>
            <BarChartOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
            <Title level={4} style={{ color: isDarkMode ? '#fff' : '#000' }}>
              No charts available
            </Title>
            <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
              Try adjusting your filters or use the customize feature to create custom charts
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Button 
                type="primary" 
                icon={<ExperimentOutlined />}
                onClick={handleCustomize}
              >
                Customize Dashboard
              </Button>
            </div>
          </Card>
        )}
      </Content>

      {/* Filter Sidebar */}
      <Drawer
        title={
          <span style={{ color: isDarkMode ? '#fff' : '#000' }}>
            <FilterOutlined style={{ marginRight: '8px' }} />
            Real-time Filters
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
          />
        )}
      </Drawer>
    </Layout>
  );
};

export default Dashboard;