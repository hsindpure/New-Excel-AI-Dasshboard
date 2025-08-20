// frontend/src/components/FilterSidebar.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Checkbox, 
  Input, 
  Typography, 
  Space, 
  Button, 
  Badge,
  Collapse,
  Empty,
  message
} from 'antd';
import { 
  SearchOutlined, 
  ClearOutlined, 
  FilterOutlined 
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Search } = Input;
const { Panel } = Collapse;

const FilterSidebar = ({ filterOptions, activeFilters, onFilterChange, isDarkMode }) => {
  const [localFilters, setLocalFilters] = useState({});
  const [searchTerms, setSearchTerms] = useState({});

  // Initialize local filters from activeFilters
  useEffect(() => {
    console.log('🔄 Active filters changed:', activeFilters);
    setLocalFilters(activeFilters || {});
  }, [activeFilters]);

  // Debounced filter application - ONLY when local filters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      const filtersChanged = JSON.stringify(localFilters) !== JSON.stringify(activeFilters);
      
      if (filtersChanged) {
        console.log('🔍 Applying debounced filter change:', localFilters);
        onFilterChange(localFilters);
      }
    }, 300); // Reduced debounce time for better responsiveness

    return () => clearTimeout(debounceTimer);
  }, [localFilters]); // Only depend on localFilters

  const handleFilterChange = useCallback((filterKey, values) => {
    console.log(`🔧 Filter change for ${filterKey}:`, values);
    
    setLocalFilters(prevFilters => {
      const newFilters = { ...prevFilters };
      
      if (values.length === 0) {
        delete newFilters[filterKey];
      } else {
        newFilters[filterKey] = values;
      }
      
      console.log('📝 New local filters:', newFilters);
      return newFilters;
    });
  }, []);

  const handleSelectAll = useCallback((filterKey, allValues) => {
    console.log(`✅ Select all for ${filterKey}:`, allValues.length, 'items');
    handleFilterChange(filterKey, allValues);
  }, [handleFilterChange]);

  const handleClearFilter = useCallback((filterKey) => {
    console.log(`❌ Clear filter for ${filterKey}`);
    handleFilterChange(filterKey, []);
  }, [handleFilterChange]);

  const handleClearAllFilters = useCallback(() => {
    console.log('🗑️ Clearing ALL filters - triggered');
    
    // Clear local state immediately
    setLocalFilters({});
    setSearchTerms({});
    
    // Notify parent component
    onFilterChange({});
    
    // Show success message
    message.success('All filters cleared');
    
    console.log('✅ All filters cleared successfully');
  }, [onFilterChange]);

  const handleSearch = useCallback((filterKey, value) => {
    console.log(`🔍 Search in ${filterKey}:`, value);
    setSearchTerms(prev => ({
      ...prev,
      [filterKey]: value
    }));
  }, []);

  const getFilteredOptions = useCallback((filterKey, options) => {
    const searchTerm = searchTerms[filterKey];
    if (!searchTerm) return options;
    
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerms]);

  const getTotalActiveFilters = useMemo(() => {
    const total = Object.values(localFilters).reduce((count, filterValues) => {
      return count + (filterValues?.length || 0);
    }, 0);
    console.log('📊 Total active filters calculated:', total);
    return total;
  }, [localFilters]);

  // Memoize filter options to prevent unnecessary re-renders
  const memoizedFilterOptions = useMemo(() => {
    return filterOptions || {};
  }, [filterOptions]);

  if (!memoizedFilterOptions || Object.keys(memoizedFilterOptions).length === 0) {
    return (
      <div style={{ 
        padding: '24px', 
        textAlign: 'center',
        background: isDarkMode ? '#1f1f1f' : '#fff',
        height: '100%'
      }}>
        <Empty 
          description={
            <Text style={{ color: isDarkMode ? '#a0a0a0' : '#666' }}>
              No filters available for this dataset
            </Text>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div style={{ 
      background: isDarkMode ? '#1f1f1f' : '#fff',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 24px',
        borderBottom: `1px solid ${isDarkMode ? '#434343' : '#f0f0f0'}`,
        flexShrink: 0,
        background: isDarkMode ? '#1f1f1f' : '#fff'
      }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge count={getTotalActiveFilters} size="small">
              <Title level={5} style={{ margin: 0, color: isDarkMode ? '#fff' : '#000' }}>
                Active Filters
              </Title>
            </Badge>
            
            <Button 
              type="link" 
              size="small"
              icon={<ClearOutlined />}
              onClick={handleClearAllFilters}
              disabled={getTotalActiveFilters === 0}
              style={{ 
                color: getTotalActiveFilters > 0 ? '#ff4d4f' : (isDarkMode ? '#555' : '#999'), 
                padding: 0,
                fontWeight: getTotalActiveFilters > 0 ? 'bold' : 'normal'
              }}
            >
              Clear All
            </Button>
          </div>
          
          <Text style={{ fontSize: '12px', color: isDarkMode ? '#a0a0a0' : '#666' }}>
            Changes apply instantly • {getTotalActiveFilters} filter{getTotalActiveFilters !== 1 ? 's' : ''} active
          </Text>
        </Space>
      </div>

      {/* Filter Panels */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        padding: '16px 0'
      }}>
        <Collapse 
          defaultActiveKey={Object.keys(memoizedFilterOptions)}
          ghost
          expandIconPosition="right"
          size="small"
        >
          {Object.entries(memoizedFilterOptions).map(([filterKey, filterData]) => {
            const { label, options } = filterData;
            const filteredOptions = getFilteredOptions(filterKey, options);
            const selectedValues = localFilters[filterKey] || [];
            const allValues = options.map(opt => opt.value);

            return (
              <Panel 
                header={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                      {label}
                    </Text>
                    {selectedValues.length > 0 && (
                      <Badge 
                        count={selectedValues.length} 
                        size="small"
                        style={{ marginRight: '8px' }}
                      />
                    )}
                  </div>
                }
                key={filterKey}
                style={{
                  background: isDarkMode ? '#262626' : '#fafafa',
                  marginBottom: '8px',
                  border: `1px solid ${isDarkMode ? '#434343' : '#f0f0f0'}`,
                  borderRadius: '6px'
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {/* Search */}
                  {options.length > 5 && (
                    <Search
                      placeholder={`Search ${label.toLowerCase()}...`}
                      size="small"
                      prefix={<SearchOutlined />}
                      onChange={(e) => handleSearch(filterKey, e.target.value)}
                      value={searchTerms[filterKey] || ''}
                      style={{ marginBottom: '8px' }}
                      allowClear
                    />
                  )}

                  {/* Select/Clear All */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <Button 
                      type="link" 
                      size="small"
                      onClick={() => handleSelectAll(filterKey, allValues)}
                      disabled={selectedValues.length === allValues.length}
                      style={{ 
                        padding: 0, 
                        height: 'auto',
                        color: selectedValues.length === allValues.length ? '#999' : '#1890ff'
                      }}
                    >
                      Select All ({allValues.length})
                    </Button>
                    
                    <Button 
                      type="link" 
                      size="small"
                      onClick={() => handleClearFilter(filterKey)}
                      disabled={selectedValues.length === 0}
                      style={{ 
                        padding: 0, 
                        height: 'auto',
                        color: selectedValues.length === 0 ? '#999' : '#ff4d4f'
                      }}
                    >
                      Clear ({selectedValues.length})
                    </Button>
                  </div>

                  {/* Options */}
                  <Checkbox.Group
                    value={selectedValues}
                    onChange={(values) => handleFilterChange(filterKey, values)}
                    style={{ width: '100%' }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                          <Checkbox 
                            key={option.value} 
                            value={option.value}
                            style={{ 
                              width: '100%',
                              color: isDarkMode ? '#fff' : '#000'
                            }}
                          >
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              width: 'calc(100% - 20px)'
                            }}>
                              <Text 
                                style={{ 
                                  color: isDarkMode ? '#fff' : '#000',
                                  fontSize: '13px'
                                }}
                                ellipsis={{ tooltip: option.label }}
                              >
                                {option.label}
                              </Text>
                            </div>
                          </Checkbox>
                        ))
                      ) : (
                        <Text 
                          style={{ 
                            color: isDarkMode ? '#a0a0a0' : '#666',
                            fontSize: '12px',
                            fontStyle: 'italic',
                            textAlign: 'center',
                            display: 'block',
                            padding: '8px'
                          }}
                        >
                          No options match your search
                        </Text>
                      )}
                    </Space>
                  </Checkbox.Group>
                </Space>
              </Panel>
            );
          })}
        </Collapse>
      </div>

      {/* Footer */}
      <div style={{ 
        padding: '16px 24px',
        borderTop: `1px solid ${isDarkMode ? '#434343' : '#f0f0f0'}`,
        background: isDarkMode ? '#262626' : '#fafafa',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: '12px', color: isDarkMode ? '#a0a0a0' : '#666' }}>
            <FilterOutlined style={{ marginRight: '4px' }} />
            {getTotalActiveFilters} filter{getTotalActiveFilters !== 1 ? 's' : ''} applied
          </Text>
          
          {getTotalActiveFilters > 0 && (
            <Button 
              size="small"
              type="primary"
              danger
              onClick={handleClearAllFilters}
              style={{ fontSize: '11px' }}
            >
              Reset All
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterSidebar;