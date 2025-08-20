// frontend/src/components/FileUpload.js
import React, { useState } from 'react';
import { 
  Upload, 
  Button, 
  Typography, 
  Progress, 
  Card, 
  Space, 
  Alert,
  Row,
  Col,
  Switch,
  Spin,
  Descriptions,
  Divider
} from 'antd';
import { 
  InboxOutlined, 
  ArrowLeftOutlined, 
  FileTextOutlined,
  CheckCircleOutlined,
  SunOutlined,
  MoonOutlined,
  BarChartOutlined,
  RocketOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import { uploadFile } from '../services/api';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

const FileUpload = ({ onFileUploaded, onBack, onToggleTheme, isDarkMode }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [generatingDashboard, setGeneratingDashboard] = useState(false);

  const handleUpload = async (file) => {
    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);
      setSuccess(false);
      setUploadResult(null);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 10;
        });
      }, 200);

      const result = await uploadFile(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setSuccess(true);
      setUploadResult(result);

      console.log('📁 File upload result:', result);

    } catch (error) {
      setError(error.message || 'Upload failed. Please try again.');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateDashboard = async () => {
    if (!uploadResult) return;
    
    try {
      setGeneratingDashboard(true);
      console.log('🚀 Generating dashboard for session:', uploadResult.sessionId);
      
      // Small delay to show loading state
      setTimeout(() => {
        onFileUploaded(uploadResult);
      }, 1500);
      
    } catch (error) {
      setError('Failed to generate dashboard: ' + error.message);
    } finally {
      setGeneratingDashboard(false);
    }
  };

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv,.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      // Validate file type
      const isValidType = file.type === 'text/csv' || 
                         file.type === 'application/vnd.ms-excel' ||
                         file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                         file.name.endsWith('.csv') ||
                         file.name.endsWith('.xlsx') ||
                         file.name.endsWith('.xls');

      if (!isValidType) {
        setError('Please upload only CSV or Excel files');
        return false;
      }

      // Validate file size (100MB)
      const isValidSize = file.size / 1024 / 1024 < 100;
      if (!isValidSize) {
        setError('File size must be less than 100MB');
        return false;
      }

      handleUpload(file);
      return false; // Prevent default upload
    }
  };

  const supportedFormats = [
    { type: 'CSV', description: 'Comma-separated values', icon: '📊' },
    { type: 'Excel (.xlsx)', description: 'Microsoft Excel files', icon: '📈' },
    { type: 'Excel (.xls)', description: 'Legacy Excel format', icon: '📉' }
  ];

  return (
    <div style={{ minHeight: '100vh', background: isDarkMode ? '#141414' : '#f0f2f5' }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 24px', 
        background: isDarkMode ? '#001529' : '#fff',
        borderBottom: `1px solid ${isDarkMode ? '#434343' : '#f0f0f0'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
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
            <Title level={4} style={{ margin: 0, color: isDarkMode ? '#fff' : '#000' }}>
              Upload Your Data
            </Title>
          </div>
        </div>
        <Space>
          <SunOutlined />
          <Switch checked={isDarkMode} onChange={onToggleTheme} />
          <MoonOutlined />
        </Space>
      </div>

      {/* Main Content */}
      <div style={{ padding: '60px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Upload Section */}
          <Card 
            style={{ 
              marginBottom: '32px',
              background: isDarkMode ? '#1f1f1f' : '#fff',
              borderColor: isDarkMode ? '#434343' : '#f0f0f0'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <Title level={2} style={{ color: isDarkMode ? '#fff' : '#000' }}>
                Upload Your Data File
              </Title>
              <Paragraph style={{ fontSize: '16px', color: isDarkMode ? '#a0a0a0' : '#666' }}>
                Drag and drop your CSV or Excel file, or click to browse
              </Paragraph>
            </div>

            {!uploading && !success && (
              <Dragger 
                {...uploadProps}
                style={{ 
                  backgroundColor: isDarkMode ? '#2a2a2a' : '#fafafa',
                  borderColor: isDarkMode ? '#434343' : '#d9d9d9'
                }}
              >
                <p style={{ margin: '24px 0' }}>
                  <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                </p>
                <Title level={4} style={{ color: isDarkMode ? '#fff' : '#000' }}>
                  Click or drag file to this area to upload
                </Title>
                <Paragraph style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
                  Support for CSV and Excel files up to 100MB. 
                  Your data will be processed securely and temporarily.
                </Paragraph>
              </Dragger>
            )}

            {uploading && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" style={{ marginBottom: '24px' }} />
                <Title level={4} style={{ marginBottom: '16px', color: isDarkMode ? '#fff' : '#000' }}>
                  Processing your file...
                </Title>
                <Progress 
                  percent={Math.round(uploadProgress)} 
                  status="active"
                  strokeColor="#1890ff"
                  style={{ marginBottom: '16px' }}
                />
                <Paragraph style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
                  Analyzing data structure and generating insights
                </Paragraph>
              </div>
            )}

            {success && uploadResult && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <CheckCircleOutlined 
                  style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} 
                />
                <Title level={4} style={{ color: isDarkMode ? '#fff' : '#000', marginBottom: '24px' }}>
                  File processed successfully!
                </Title>
                
                {/* File Details */}
                <Card 
                  size="small" 
                  style={{ 
                    marginBottom: '24px',
                    background: isDarkMode ? '#262626' : '#f9f9f9',
                    borderColor: isDarkMode ? '#434343' : '#f0f0f0'
                  }}
                >
                  <Descriptions 
                    title={
                      <span style={{ color: isDarkMode ? '#fff' : '#000' }}>
                        <DatabaseOutlined style={{ marginRight: '8px' }} />
                        Data Summary
                      </span>
                    }
                    column={2}
                    size="small"
                  >
                    <Descriptions.Item 
                      label={<span style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>File Name</span>}
                    >
                      <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>
                        {uploadResult.preview.fileName}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item 
                      label={<span style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>Total Rows</span>}
                    >
                      <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>
                        {uploadResult.preview.rowCount.toLocaleString()}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item 
                      label={<span style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>Columns</span>}
                    >
                      <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>
                        {uploadResult.preview.columns}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item 
                      label={<span style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>Session ID</span>}
                    >
                      <Text style={{ color: isDarkMode ? '#fff' : '#000', fontSize: '12px' }}>
                        {uploadResult.sessionId.slice(-8)}...
                      </Text>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Divider style={{ borderColor: isDarkMode ? '#434343' : '#f0f0f0' }} />

                {/* Generate Dashboard Button */}
                <Space direction="vertical" size="large">
                  <Button
                    type="primary"
                    size="large"
                    icon={<RocketOutlined />}
                    onClick={handleGenerateDashboard}
                    loading={generatingDashboard}
                    style={{
                      height: '50px',
                      fontSize: '16px',
                      padding: '0 32px',
                      borderRadius: '8px'
                    }}
                  >
                    {generatingDashboard ? 'Generating Dashboard...' : 'Generate AI Dashboard'}
                  </Button>
                  
                  <Paragraph style={{ color: isDarkMode ? '#a0a0a0' : '#666', margin: 0 }}>
                    Click to create intelligent visualizations with AI-powered insights
                  </Paragraph>
                </Space>
              </div>
            )}

            {error && (
              <Alert
                message="Upload Error"
                description={error}
                type="error"
                showIcon
                style={{ marginTop: '16px' }}
                action={
                  <Button size="small" onClick={() => setError(null)}>
                    Try Again
                  </Button>
                }
              />
            )}
          </Card>

          {/* Supported Formats */}
          <Card 
            title={
              <span style={{ color: isDarkMode ? '#fff' : '#000' }}>
                <FileTextOutlined style={{ marginRight: '8px' }} />
                Supported File Formats
              </span>
            }
            style={{ 
              marginBottom: '32px',
              background: isDarkMode ? '#1f1f1f' : '#fff',
              borderColor: isDarkMode ? '#434343' : '#f0f0f0'
            }}
            headStyle={{ 
              background: isDarkMode ? '#262626' : '#fafafa',
              borderBottomColor: isDarkMode ? '#434343' : '#f0f0f0'
            }}
          >
            <Row gutter={[16, 16]}>
              {supportedFormats.map((format, index) => (
                <Col xs={24} sm={8} key={index}>
                  <div style={{ 
                    padding: '16px', 
                    border: `1px solid ${isDarkMode ? '#434343' : '#f0f0f0'}`,
                    borderRadius: '6px',
                    textAlign: 'center',
                    background: isDarkMode ? '#2a2a2a' : '#fafafa'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                      {format.icon}
                    </div>
                    <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                      {format.type}
                    </Text>
                    <br />
                    <Text style={{ fontSize: '12px', color: isDarkMode ? '#a0a0a0' : '#666' }}>
                      {format.description}
                    </Text>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>

          {/* Tips */}
          <Card
            title={
              <span style={{ color: isDarkMode ? '#fff' : '#000' }}>
                💡 Tips for Better Results
              </span>
            }
            style={{ 
              background: isDarkMode ? '#1f1f1f' : '#fff',
              borderColor: isDarkMode ? '#434343' : '#f0f0f0'
            }}
            headStyle={{ 
              background: isDarkMode ? '#262626' : '#fafafa',
              borderBottomColor: isDarkMode ? '#434343' : '#f0f0f0'
            }}
          >
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12}>
                <Space direction="vertical" size="small">
                  <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                    📊 Data Structure
                  </Text>
                  <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
                    • Include column headers in the first row
                  </Text>
                  <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
                    • Use consistent data formats
                  </Text>
                  <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
                    • Avoid merged cells in Excel
                  </Text>
                </Space>
              </Col>
              <Col xs={24} sm={12}>
                <Space direction="vertical" size="small">
                  <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                    🎯 Best Practices
                  </Text>
                  <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
                    • Remove empty rows and columns
                  </Text>
                  <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
                    • Use numeric values for calculations
                  </Text>
                  <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
                    • Include date columns for trends
                  </Text>
                </Space>
              </Col>
            </Row>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;