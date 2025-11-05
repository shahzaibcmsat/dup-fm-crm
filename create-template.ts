import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Create sample template with correct column headers
const templateData = [
  {
    "Name": "John Smith",
    "Email": "john.smith@example.com",
    "Phone Number": "555-123-4567",
    "Subject": "Interested in flooring services",
    "Lead Description": "Looking for hardwood flooring installation for living room and kitchen. Budget around $5000."
  },
  {
    "Name": "Sarah Johnson",
    "Email": "sarah.j@company.com",
    "Phone Number": "555-987-6543",
    "Subject": "Commercial flooring inquiry",
    "Lead Description": "Need commercial grade flooring for office space, approximately 2000 sq ft."
  },
  {
    "Name": "Mike Davis",
    "Email": "mike.davis@email.com",
    "Phone Number": "555-555-1234",
    "Subject": "Tile installation quote",
    "Lead Description": "Interested in ceramic tile for bathroom remodel. Looking for estimates."
  }
];

// Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(templateData);

// Set column widths
ws['!cols'] = [
  { wch: 20 },  // Name
  { wch: 30 },  // Email
  { wch: 18 },  // Phone Number
  { wch: 30 },  // Subject
  { wch: 60 }   // Lead Description
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, "Leads");

// Write file
const outputPath = path.join(process.cwd(), 'sample-leads-template.xlsx');
XLSX.writeFile(wb, outputPath);

console.log('✅ Template created successfully at:', outputPath);
console.log('\n📋 Template includes the following columns:');
console.log('   1. Name (Required)');
console.log('   2. Email (Required)');
console.log('   3. Phone Number (Optional)');
console.log('   4. Subject (Optional)');
console.log('   5. Lead Description (Optional)');
console.log('\n💡 You can delete the sample rows and add your own data.');
