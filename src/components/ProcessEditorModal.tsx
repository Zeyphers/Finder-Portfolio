import React, { useState } from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Ensure window.Quill is set for modules that require it
if (typeof window !== 'undefined') {
  (window as any).Quill = Quill;
}
import ImageResize from 'quill-image-resize-module-react';

// Register the image resize module
Quill.register('modules/imageResize', ImageResize);

interface ProcessEditorModalProps {
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export function ProcessEditorModal({ initialValue, onSave, onClose }: ProcessEditorModalProps) {
  const [value, setValue] = useState(initialValue || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col h-[80vh]">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <h2 className="text-lg font-semibold text-slate-800">Edit Process Details</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm font-medium">Close</button>
        </div>
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto pb-12">
            <ReactQuill 
              theme="snow" 
              value={value} 
              onChange={setValue} 
              className="h-full"
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                  [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
                  ['link', 'image', 'video'],
                  ['clean']
                ],
                imageResize: {
                  parchment: Quill.import('parchment'),
                  modules: ['Resize', 'DisplaySize']
                }
              }}
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition">Cancel</button>
          <button onClick={() => onSave(value)} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm">Save</button>
        </div>
      </div>
    </div>
  );
}
