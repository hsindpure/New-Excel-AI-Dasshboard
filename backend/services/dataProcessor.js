// backend/services/dataProcessor.js
const fs = require('fs');
const path = require('path');
const csv = require('papaparse');
const XLSX = require('xlsx');

class DataProcessor {
  
  async processFile(file) {
    try {
      console.log('📁 Processing file:', file.originalname);
      
      const extension = path.extname(file.originalname).toLowerCase();
      let data = [];
      
      // Parse file based on extension
      if (extension === '.csv') {
        data = await this.parseCSV(file.path);
      } else if (extension === '.xlsx' || extension === '.xls') {
        data = await this.parseExcel(file.path);
      } else {
        throw new Error('Unsupported file format');
      }
      
      // Clean up uploaded file
      this.cleanupFile(file.path);
      
      // Generate schema
      const schema = this.generateSchema(data);
      
      console.log('✅ Data processed:', data.length, 'rows,', schema.columns.length, 'columns');
      
      return {
        data,
        schema,
        stats: {
          totalRows: data.length,
          totalColumns: schema.columns.length,
          measures: schema.measures.length,
          dimensions: schema.dimensions.length
        }
      };
      
    } catch (error) {
      console.error('❌ Data processing error:', error);
      throw error;
    }
  }
  
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      csv.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (header) => header.trim(),
        transform: (value, field) => {
          // Clean and transform values
          if (typeof value === 'string') {
            value = value.trim();
            // Try to parse numbers
            const num = parseFloat(value);
            if (!isNaN(num) && isFinite(num)) {
              return num;
            }
            // Try to parse dates
            const date = new Date(value);
            if (!isNaN(date.getTime()) && value.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/)) {
              return date.toISOString().split('T')[0];
            }
          }
          return value;
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('⚠️ CSV parsing warnings:', results.errors);
          }
          resolve(results.data.filter(row => Object.keys(row).length > 0));
        },
        error: (error) => {
          reject(new Error('CSV parsing failed: ' + error.message));
        }
      });
    });
  }
  
  async parseExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with header row
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false
      });
      
      if (data.length === 0) {
        throw new Error('Excel file is empty');
      }
      
      // Extract headers and data
      const headers = data[0].map(h => String(h).trim());
      const rows = data.slice(1);
      
      // Convert to object format
      const jsonData = rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          let value = row[index];
          
          // Data type inference and cleaning
          if (value !== null && value !== undefined) {
            if (typeof value === 'string') {
              value = value.trim();
              // Try to parse numbers
              const num = parseFloat(value);
              if (!isNaN(num) && isFinite(num)) {
                value = num;
              }
            }
            // Handle Excel dates
            if (typeof value === 'number' && value > 25000 && value < 50000) {
              const excelDate = XLSX.SSF.parse_date_code(value);
              if (excelDate) {
                value = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
              }
            }
          }
          
          obj[header] = value;
        });
        return obj;
      }).filter(row => Object.values(row).some(val => val !== null && val !== undefined && val !== ''));
      
      return jsonData;
      
    } catch (error) {
      throw new Error('Excel parsing failed: ' + error.message);
    }
  }
  
  generateSchema(data) {
    if (!data || data.length === 0) {
      throw new Error('No data to analyze');
    }
    
    const columns = Object.keys(data[0]);
    const schema = {
      columns: [],
      measures: [],
      dimensions: []
    };
    
    columns.forEach(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      const dataType = this.inferDataType(values);
      
      const columnInfo = {
        name: column,
        type: dataType,
        nullable: values.length < data.length,
        uniqueValues: new Set(values).size,
        sampleValues: values.slice(0, 5)
      };
      
      schema.columns.push(columnInfo);
      
      // Classify as measure or dimension
      if (dataType === 'number' && columnInfo.uniqueValues > 5) {
        schema.measures.push(columnInfo);
      } else {
        schema.dimensions.push(columnInfo);
      }
    });
    
    return schema;
  }
  
  inferDataType(values) {
    if (values.length === 0) return 'string';
    
    let numberCount = 0;
    let dateCount = 0;
    let stringCount = 0;
    
    values.forEach(value => {
      if (typeof value === 'number' && !isNaN(value)) {
        numberCount++;
      } else if (typeof value === 'string') {
        // Check if it's a date string
        if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateCount++;
        } else {
          stringCount++;
        }
      } else {
        stringCount++;
      }
    });
    
    const total = values.length;
    
    // Determine dominant type (threshold: 80%)
    if (numberCount / total > 0.8) return 'number';
    if (dateCount / total > 0.8) return 'date';
    return 'string';
  }
  
  cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Cleaned up uploaded file:', filePath);
      }
    } catch (error) {
      console.warn('⚠️ Could not cleanup file:', error.message);
    }
  }
}

module.exports = new DataProcessor();