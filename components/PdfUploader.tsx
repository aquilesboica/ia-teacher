
import React, { useState } from 'react';
import { PdfContent } from '../types';

interface PdfUploaderProps {
  onContentParsed: (content: PdfContent) => void;
  isProcessing: boolean;
}

declare const pdfjsLib: any;

const PdfUploader: React.FC<PdfUploaderProps> = ({ onContentParsed, isProcessing }) => {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const typedArray = new Uint8Array(reader.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }

        onContentParsed({
          text: fullText,
          fileName: file.name
        });
      } catch (err) {
        console.error('PDF Parsing Error:', err);
        setError('Failed to parse PDF. Please try a different document.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:border-blue-400 transition-colors">
      <label className="flex flex-col items-center cursor-pointer">
        <svg className="w-10 h-10 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-semibold text-slate-700">
          {isProcessing ? 'Reading document...' : 'Upload Lesson PDF'}
        </span>
        <span className="text-xs text-slate-500 mt-1">Provide your knowledge base</span>
        <input 
          type="file" 
          className="hidden" 
          accept="application/pdf" 
          onChange={handleFileChange}
          disabled={isProcessing}
        />
      </label>
      {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
    </div>
  );
};

export default PdfUploader;
