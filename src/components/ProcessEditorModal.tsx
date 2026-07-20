import React, { useCallback, useMemo, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import BlotFormatter from 'quill-blot-formatter';
import { getImageUrl } from '../api';
import { UploadFn, extractInlineImagesFromHtml, findInlineImages } from '../inlineImages';

// Ensure window.Quill is set for modules that require it
if (typeof window !== 'undefined') {
  (window as any).Quill = Quill;
}

// Register the image resize module
Quill.register('modules/blotFormatter', BlotFormatter);

interface ProcessEditorModalProps {
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
  // When provided, images are uploaded to the image store instead of being
  // embedded in the HTML as base64. See src/inlineImages.ts for why.
  uploadImage?: UploadFn;
}

export function ProcessEditorModal({ initialValue, onSave, onClose, uploadImage }: ProcessEditorModalProps) {
  const [value, setValue] = useState(initialValue || '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  // Toolbar inserts go straight to the image store, so the editor never holds a
  // multi-megabyte data URI in the first place. Quill binds `this` to the toolbar
  // module, whose `quill` property is the live editor.
  const imageHandler = useCallback(
    function (this: { quill: any }) {
      if (!uploadImage) return;
      const editor = this.quill;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file || !editor) return;

        const range = editor.getSelection(true);
        setBusy(true);
        setStatus('Uploading image…');
        try {
          const url = await uploadImage(file);
          editor.insertEmbed(range.index, 'image', getImageUrl(url), 'user');
          editor.setSelection(range.index + 1, 0);
        } catch (err: any) {
          console.error('Process image upload failed:', err);
          alert(`Image upload failed: ${err?.message || String(err)}`);
        } finally {
          setBusy(false);
          setStatus('');
        }
      };
      input.click();
    },
    [uploadImage]
  );

  // Memoised: rebuilding the modules object on every render tears down and
  // re-creates the Quill instance, which loses the cursor mid-typing.
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike', 'blockquote'],
          [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
          ['link', 'image', 'video'],
          ['clean'],
        ],
        ...(uploadImage ? { handlers: { image: imageHandler } } : {}),
      },
      blotFormatter: {},
    }),
    [imageHandler, uploadImage]
  );

  // Safety net for paste and drag-drop, which bypass the toolbar handler.
  const handleSave = async () => {
    if (!uploadImage) {
      onSave(value);
      return;
    }

    const pending = findInlineImages(value);
    if (pending.length === 0) {
      onSave(value);
      return;
    }

    setBusy(true);
    setStatus(`Uploading ${pending.length} pasted image${pending.length === 1 ? '' : 's'}…`);
    try {
      const { html } = await extractInlineImagesFromHtml(value, uploadImage);
      onSave(html);
    } catch (err: any) {
      console.error('Failed to upload pasted images:', err);
      alert(`Could not upload the pasted image(s): ${err?.message || String(err)}\n\nNothing was saved.`);
      setBusy(false);
      setStatus('');
    }
  };

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
              modules={modules}
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end items-center gap-2 bg-slate-50 rounded-b-xl">
          {status && <span className="mr-auto text-sm text-slate-500">{status}</span>}
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
