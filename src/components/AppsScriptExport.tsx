import React from 'react';
import { Copy, Check } from 'lucide-react';

export const AppsScriptExport: React.FC = () => {
  const [copied, setCopied] = React.useState(false);

  const scriptCode = `/**
 * AI Recruitment Screening Architect - Google Sheets Solution
 * Use Case: React Native Engineer CV Screening
 */

const CONFIG = {
  MENU_NAME: "AI Recruitment",
  CANDIDATES_SHEET: "Candidates",
  CONFIG_SHEET: "Config",
  GROQ_API_KEY_CELL: "B1", // Cell in Config sheet
  JD_TEXT_CELL: "B2",        // Cell in Config sheet
  MODEL_NAME: "openai/gpt-oss-20b"
};

/**
 * Adds a custom menu to the spreadsheet on open.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu(CONFIG.MENU_NAME)
    .addItem('Evaluate Selected Candidate', 'evaluateSelectedCandidate')
    .addItem('Setup Sheets', 'setupSheets')
    .addToUi();
}

/**
 * Main function to evaluate the selected candidate row.
 */
function evaluateSelectedCandidate() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.CANDIDATES_SHEET);
  const activeCell = sheet.getActiveCell();
  const rowIndex = activeCell.getRow();
  
  if (rowIndex < 2) {
    SpreadsheetApp.getUi().alert('Please select a candidate row (row 2 or below).');
    return;
  }

  // Column Mapping (Adjust based on your sheet structure)
  const COL_NAME = 1;
  const COL_FILE_ID = 2;
  const COL_STATUS = 3;
  const COL_SCORE = 4;
  const COL_RECOMMENDATION = 5;
  const COL_STRENGTHS = 6;
  const COL_GAPS = 7;
  const COL_SUMMARY = 8;
  const COL_RAW_JSON = 9;
  const COL_DATE = 10;

  const candidateName = sheet.getRange(rowIndex, COL_NAME).getValue();
  const fileIdOrLink = sheet.getRange(rowIndex, COL_FILE_ID).getValue();
  
  if (!fileIdOrLink) {
    SpreadsheetApp.getUi().alert('CV File ID or Link is missing.');
    return;
  }

  try {
    sheet.getRange(rowIndex, COL_STATUS).setValue('Extracting Text...');
    const fileId = extractFileId(fileIdOrLink);
    const cvText = extractTextFromDriveFile(fileId);
    
    sheet.getRange(rowIndex, COL_STATUS).setValue('AI Evaluating...');
    const evaluation = callGroqAI(cvText);
    
    // Write results back
    sheet.getRange(rowIndex, COL_SCORE).setValue(evaluation.overall_score);
    sheet.getRange(rowIndex, COL_RECOMMENDATION).setValue(evaluation.recommendation);
    sheet.getRange(rowIndex, COL_STRENGTHS).setValue(evaluation.strengths.join('\\n'));
    sheet.getRange(rowIndex, COL_GAPS).setValue(evaluation.gaps.join('\\n'));
    sheet.getRange(rowIndex, COL_SUMMARY).setValue(evaluation.recruiter_summary);
    sheet.getRange(rowIndex, COL_RAW_JSON).setValue(JSON.stringify(evaluation));
    sheet.getRange(rowIndex, COL_DATE).setValue(new Date());
    sheet.getRange(rowIndex, COL_STATUS).setValue('Completed');
    
    SpreadsheetApp.getUi().alert('Evaluation complete for ' + candidateName);
  } catch (e) {
    sheet.getRange(rowIndex, COL_STATUS).setValue('Error: ' + e.toString());
    Logger.log(e);
    SpreadsheetApp.getUi().alert('Error: ' + e.toString());
  }
}

/**
 * Extracts File ID from a Google Drive link or returns the ID if already provided.
 */
function extractFileId(input) {
  const regex = /[-\\w]{25,}/;
  const match = input.match(regex);
  return match ? match[0] : input;
}

/**
 * Extracts text from a PDF or Text file in Google Drive.
 */
function extractTextFromDriveFile(fileId) {
  const file = DriveApp.getFileById(fileId);
  const mimeType = file.getMimeType();
  
  if (mimeType === 'application/pdf') {
    // PDF extraction using Google Docs OCR workaround
    const resource = {
      title: file.getName(),
      mimeType: mimeType
    };
    const doc = Drive.Files.insert(resource, file.getBlob(), { ocr: true });
    const docFile = DocumentApp.openById(doc.id);
    const text = docFile.getBody().getText();
    Drive.Files.remove(doc.id); // Clean up temp doc
    return text;
  } else {
    return file.getBlob().getDataAsString();
  }
}

/**
 * Calls Groq (OpenAI-compatible) API with the CV text and JD prompt.
 */
function callGroqAI(cvText) {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.CONFIG_SHEET);
  const apiKey = configSheet.getRange(CONFIG.GROQ_API_KEY_CELL).getValue();
  const jdText = configSheet.getRange(CONFIG.JD_TEXT_CELL).getValue();
  
  if (!apiKey) throw new Error('Groq API Key missing in Config sheet.');

  const prompt = \`Evaluate this CV against the following Job Description. 
  Return ONLY a JSON object with: candidate_name, overall_score (0-100), recommendation, strengths (array), gaps (array), recruiter_summary.
  
  JD: \${jdText}
  
  CV: \${cvText}\`;

  const payload = {
    model: CONFIG.MODEL_NAME,
    input: prompt
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch('https://api.groq.com/openai/v1/responses', options);
  const json = JSON.parse(response.getContentText());

  if (json.error) throw new Error(json.error.message || 'Groq API error');

  // Groq Responses API returns the final text in output_text
  return JSON.parse(json.output_text);
}

/**
 * Helper to setup the spreadsheet structure.
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Setup Candidates Sheet
  let candSheet = ss.getSheetByName(CONFIG.CANDIDATES_SHEET);
  if (!candSheet) candSheet = ss.insertSheet(CONFIG.CANDIDATES_SHEET);
  const headers = ['Candidate Name', 'CV File ID / Link', 'Status', 'Score', 'Recommendation', 'Strengths', 'Gaps', 'Recruiter Summary', 'Raw JSON', 'Last Evaluated At'];
  candSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');
  
  // Setup Config Sheet
  let configSheet = ss.getSheetByName(CONFIG.CONFIG_SHEET);
  if (!configSheet) configSheet = ss.insertSheet(CONFIG.CONFIG_SHEET);
  configSheet.getRange('A1').setValue('Groq API Key:').setFontWeight('bold');
  configSheet.getRange('A2').setValue('Job Description:').setFontWeight('bold');
  configSheet.setColumnWidth(2, 600);
}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Google Apps Script Code</h3>
          <p className="text-sm text-gray-500">Copy this code into your Google Sheets Script Editor (Extensions &gt; Apps Script)</p>
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>
      <div className="p-0 bg-[#1e1e1e] overflow-x-auto">
        <pre className="p-6 text-xs text-gray-300 font-mono leading-relaxed">
          {scriptCode}
        </pre>
      </div>
    </div>
  );
};
