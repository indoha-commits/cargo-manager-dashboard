import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Upload, File, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

import { getOpsClients } from '@/app/api/ops';
import { fetchJson } from '@/app/api/client';

type Category = 'MEDS_BEVERAGE' | 'RAW_MATERIALS' | 'ELECTRONICS';

function requiredDocsForCategory(category: Category | ''): string[] {
  if (!category) return [];
  const base = ['BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST'];
  if (category === 'MEDS_BEVERAGE') return [...base, 'IMPORT_LICENSE'];
  if (category === 'RAW_MATERIALS') return [...base];
  return [...base, 'TYPE_APPROVAL'];
}

export function ImportCargoPage() {
  const [category, setCategory] = useState<Category | ''>('');

  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedCargoId, setSelectedCargoId] = useState<string>('');

  const [milestoneCompletedAt, setMilestoneCompletedAt] = useState<string>('');
  const [startingMilestone, setStartingMilestone] = useState<'DOCS_UPLOADED' | 'DOCS_VERIFIED' | 'DEPARTED_PORT' | 'IN_ROUTE_RUSUMO' | 'PHYSICAL_VERIFICATION' | 'WAREHOUSE_ARRIVAL'>('DOCS_UPLOADED');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const [notAvailableDocs, setNotAvailableDocs] = useState<Record<string, boolean>>({});
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [wh7File, setWh7File] = useState<File | null>(null);
  const [assessmentFile, setAssessmentFile] = useState<File | null>(null);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [t1File, setT1File] = useState<File | null>(null);
  const [exitNoteFile, setExitNoteFile] = useState<File | null>(null);

  const requiredDocs = useMemo(() => requiredDocsForCategory(category), [category]);
  const cargoIdPlaceholder = category ? `Enter cargo ID (${category})` : 'Enter cargo ID';
  
  const milestoneDateLabel = useMemo(() => {
    switch (startingMilestone) {
      case 'DOCS_UPLOADED':
        return 'Docs Uploaded At (optional)';
      case 'DOCS_VERIFIED':
        return 'Docs Verified At (optional)';
      case 'DEPARTED_PORT':
        return 'Departed from Port At (optional)';
      case 'IN_ROUTE_RUSUMO':
        return 'Started Route to Rusumo At (optional)';
      case 'PHYSICAL_VERIFICATION':
        return 'Physical Verification At (optional)';
      case 'WAREHOUSE_ARRIVAL':
        return 'Warehouse Arrival At (optional)';
      default:
        return 'Milestone Completed At (optional)';
    }
  }, [startingMilestone]);
  
  const needsAssessment = useMemo(() => {
    return ['DEPARTED_PORT', 'IN_ROUTE_RUSUMO', 'PHYSICAL_VERIFICATION', 'WAREHOUSE_ARRIVAL'].includes(startingMilestone);
  }, [startingMilestone]);
  
  const renderFileUpload = (label: string, file: File | null, setFile: (file: File | null) => void) => (
    <div className="border rounded-lg p-5" style={{ borderColor: file ? 'var(--gold-accent)' : 'var(--border)', backgroundColor: file ? 'rgba(212, 175, 55, 0.05)' : 'transparent' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <File className="w-4 h-4 opacity-60" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {file && <CheckCircle2 className="w-5 h-5 text-green-600" />}
      </div>
      <label className="block cursor-pointer">
        <div className="border-2 border-dashed rounded-lg p-6 text-center transition-all hover:border-opacity-60" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
          {file ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm font-medium" style={{ color: 'var(--gold-accent)' }}>
                <File className="w-5 h-5" />
                <span>{file.name}</span>
              </div>
              <div className="text-xs opacity-60">{(file.size / 1024).toFixed(1)} KB</div>
              <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); }} className="text-xs text-red-600 hover:text-red-700 underline mt-2">Remove</button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto opacity-40" />
              <div className="text-sm font-medium opacity-70">Click to upload {label}</div>
              <div className="text-xs opacity-50">PDF, DOC, DOCX, JPG, PNG (max 10MB)</div>
            </div>
          )}
        </div>
        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
    </div>
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingClients(true);
        setError(null);
        const res = await getOpsClients();
        setClients(res.clients);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoadingClients(false);
      }
    };

    void load();
  }, []);

  const onProceed = () => {
    setError(null);
    if (!category) return setError('Select a category');
    if (!selectedClientId) return setError('Select a client');
    if (!selectedCargoId.trim()) return setError('Enter a cargo ID');
    
    setShowUploadForm(true);
  };
  
  const onProceedToAssessment = () => {
    setError(null);
    setShowAssessmentForm(true);
  };

  const uploadFileToStorage = async (file: File, path: string): Promise<string> => {
    console.log(`[UPLOAD] Starting upload: ${file.name} -> ${path}`);
    
    // Get signed upload URL
    const signedUrlRes = await fetchJson<{ signed_url: string }>(`/ops/storage/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
    console.log(`[UPLOAD] Got signed URL for ${path}`);
    
    // Upload file to Supabase Storage using signed URL
    const uploadRes = await fetch(signedUrlRes.signed_url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    
    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error(`[UPLOAD] Failed to upload ${path}:`, errorText);
      throw new Error(`Upload failed: ${errorText}`);
    }
    
    console.log(`[UPLOAD] Successfully uploaded ${path}`);
    return path;
  };

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!category) return setError('Select a category');
    if (!selectedClientId) return setError('Select a client');
    if (!selectedCargoId.trim()) return setError('Enter a cargo ID');

    setSubmitting(true);
    try {
      // Register cargo first
      const data = await fetchJson<{ cargo_id: string; container_id: string }>(`/ops/cargo/register`, {
        method: 'POST',
        body: JSON.stringify({
          client_id: selectedClientId,
          cargo_id: selectedCargoId,
          category,
          milestone_completed_at: milestoneCompletedAt ? new Date(milestoneCompletedAt).toISOString() : null,
          starting_milestone: startingMilestone,
        }),
      });
      
      const cargoId = data.container_id; // Use container_id (user input) not UUID
      console.log(`[REGISTER] Cargo registered: ${cargoId} (UUID: ${data.cargo_id})`);
      
      // Mark not-available documents
      for (const docType of Object.keys(notAvailableDocs).filter(k => notAvailableDocs[k])) {
        console.log(`[REGISTER] Marking document as NOT_AVAILABLE: ${docType}`);
        await fetchJson(`/ops/cargo/${cargoId}/documents/${docType}`, {
          method: 'PATCH',
          body: JSON.stringify({ provider_path: '_not_available_', status: 'NOT_AVAILABLE', import_mode: false }),
        });
      }

      // Upload required documents
      console.log(`[REGISTER] Uploading ${Object.keys(uploadedFiles).length} required documents...`);
      for (const [docType, file] of Object.entries(uploadedFiles)) {
        const path = `cargo/${cargoId}/documents/${docType}/${file.name}`;
        await uploadFileToStorage(file, path);
        
        // Update document record with file path (keep VERIFIED for import)
        console.log(`[REGISTER] Updating document record: ${docType}`);
        await fetchJson(`/ops/cargo/${cargoId}/documents/${docType}`, {
          method: 'PATCH',
          body: JSON.stringify({ provider_path: path, status: 'VERIFIED', import_mode: true }),
        });
        console.log(`[REGISTER] Document updated: ${docType}`);
      }
      
      // Upload customs clearance documents if needed (as documents, not approvals)
      if (needsAssessment) {
        const customsDocs = [
          { file: wh7File, docType: 'WH7' },
          { file: assessmentFile, docType: 'ASSESSMENT' },
          { file: draftFile, docType: 'DRAFT_DECLARATION' },
          { file: t1File, docType: 'T1' },
          { file: exitNoteFile, docType: 'EXIT_NOTE' },
        ];
        
        for (const doc of customsDocs) {
          if (doc.file) {
            const path = `cargo/${cargoId}/documents/${doc.docType}/${doc.file.name}`;
            await uploadFileToStorage(doc.file, path);
            
            // Update or create document record
            await fetchJson(`/ops/cargo/${cargoId}/documents/${doc.docType}`, {
              method: 'PATCH',
              body: JSON.stringify({ provider_path: path, status: 'VERIFIED', import_mode: true }),
            });
          }
        }
      }
      
      setSuccess(`Cargo ${selectedCargoId} registered successfully${needsAssessment ? ' with customs clearance documents' : ''}`);
      
      // Reset form
      setShowUploadForm(false);
      setShowAssessmentForm(false);
      setUploadedFiles({});
      setNotAvailableDocs({});
      setWh7File(null);
      setAssessmentFile(null);
      setDraftFile(null);
      setT1File(null);
      setExitNoteFile(null);
      setSelectedCargoId('');
      setMilestoneCompletedAt('');
    } catch (e) {
      const errorMsg = String(e);
      
      // Parse error for user-friendly messages
      if (errorMsg.includes('already_exists') || errorMsg.includes('409')) {
        setError(`Cargo "${selectedCargoId}" already exists in the system. Please check the cargo list or use a different ID.`);
      } else if (errorMsg.includes('signed_upload_failed')) {
        setError('File upload failed. Please check your internet connection and try again.');
      } else if (errorMsg.includes('missing_field')) {
        setError('Please fill in all required fields before submitting.');
      } else if (errorMsg.includes('404') || errorMsg.includes('not_found')) {
        setError('API endpoint not found. Please contact support.');
      } else {
        setError(`Registration failed: ${errorMsg}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1>Register Cargo</h1>
        <p className="text-sm opacity-60 mt-2">
          Register a cargo that already started. Select which milestone is completed and upload documents later.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border px-4 py-3 text-sm" style={{ borderColor: 'rgb(239, 68, 68)' }}>
          <span style={{ fontWeight: 600 }}>Error:</span> {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-md border px-4 py-3 text-sm" style={{ borderColor: 'rgb(34, 197, 94)' }}>
          <span style={{ fontWeight: 600 }}>Success:</span> {success}
        </div>
      )}

      <div className="bg-card rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2 text-xs opacity-70">
            Cargo IDs are provided by your shipment records. We no longer pull cargo IDs from Google Drive.
          </div>
          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              Category
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as any);
                  setSelectedClientId('');
                  setSelectedCargoId('');
                  setCargos([]);
                }}
                className="w-full px-4 py-2.5 rounded-md border text-sm appearance-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
              >
                <option value="">Select category</option>
                <option value="MEDS_BEVERAGE">Meds &amp; Beverage</option>
                <option value="RAW_MATERIALS">Raw Materials</option>
                <option value="ELECTRONICS">Electronics</option>
              </select>
              <ChevronDown className="w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              Client
            </label>
            {loadingClients ? (
              <div className="flex items-center gap-2 text-sm opacity-60">Loading clients…</div>
            ) : (
              <div className="relative">
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-md border text-sm appearance-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                >
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              Cargo ID
            </label>
            <input
              type="text"
              value={selectedCargoId}
              onChange={(e) => setSelectedCargoId(e.target.value)}
              disabled={!selectedClientId}
              placeholder={cargoIdPlaceholder}
              className="w-full px-4 py-2.5 rounded-md border text-sm disabled:opacity-60"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
            />
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              {milestoneDateLabel}
            </label>
            <input
              type="datetime-local"
              value={milestoneCompletedAt}
              onChange={(e) => setMilestoneCompletedAt(e.target.value)}
              className="w-full px-4 py-2.5 rounded-md border text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
            />
            <p className="text-xs opacity-60 mt-1">Optional. Leave blank to use current date/time.</p>
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              Starting Milestone
            </label>
            <div className="relative">
              <select
                value={startingMilestone}
                onChange={(e) => setStartingMilestone(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-md border text-sm appearance-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
              >
                <option value="DOCS_UPLOADED">Docs Uploaded</option>
                <option value="DOCS_VERIFIED">Docs Verified</option>
                <option value="DEPARTED_PORT">Departed from Port</option>
                <option value="IN_ROUTE_RUSUMO">In Route to Rusumo</option>
                <option value="PHYSICAL_VERIFICATION">Physical Verification</option>
                <option value="WAREHOUSE_ARRIVAL">Warehouse Arrival</option>
              </select>
              <ChevronDown className="w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="col-span-2">
            <div className="text-xs opacity-60 mb-2">Required document folders</div>
            <div className="flex flex-wrap gap-2">
              {requiredDocs.length === 0 ? (
                <span className="text-xs opacity-60">Select a category to preview required folders.</span>
              ) : (
                requiredDocs.map((d) => (
                  <span
                    key={d}
                    className="text-xs px-2 py-1 rounded-md border"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {d}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {!showUploadForm ? (
          <div className="flex justify-end pt-6">
            <button
              type="button"
              onClick={onProceed}
              className="px-5 py-2.5 rounded-md text-sm transition-colors duration-150"
              style={{ backgroundColor: 'var(--gold-accent)', color: 'var(--navy-deep)', fontWeight: 600 }}
            >
              Proceed to Upload Documents
            </button>
          </div>
        ) : (
          <>
            <div className="border-t pt-6 mt-6" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Upload Required Documents</h3>
                  <p className="text-sm opacity-60 mt-1">
                    {startingMilestone === 'DOCS_UPLOADED' 
                      ? 'Upload the required documents for this cargo.'
                      : 'Documents are marked as verified. You can upload them now or skip.'}
                  </p>
                </div>
                <div className="text-sm font-medium px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--gold-accent)', color: 'var(--navy-deep)' }}>
                  {Object.keys(uploadedFiles).length} / {requiredDocs.length} files
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300 rounded-full"
                    style={{ 
                      width: `${(Object.keys(uploadedFiles).length / requiredDocs.length) * 100}%`,
                      backgroundColor: 'var(--gold-accent)'
                    }}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                {requiredDocs.map((docType) => {
                  const isNotAvailable = notAvailableDocs[docType] === true;
                  const hasFile = !!uploadedFiles[docType];
                  const borderColor = isNotAvailable
                    ? 'rgb(239,68,68)'
                    : hasFile
                      ? 'var(--gold-accent)'
                      : 'var(--border)';
                  const bgColor = isNotAvailable
                    ? 'rgba(239,68,68,0.05)'
                    : hasFile
                      ? 'rgba(212,175,55,0.05)'
                      : 'transparent';

                  return (
                  <div key={docType} className="border rounded-lg p-5 transition-all hover:border-opacity-80" style={{ borderColor, backgroundColor: bgColor }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4 opacity-60" />
                        <span className="text-sm font-medium">{docType}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isNotAvailable && (
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'rgb(239,68,68)' }}>
                            Not Available
                          </span>
                        )}
                        {hasFile && !isNotAvailable && (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        )}
                        {/* Not Available toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isNotAvailable) {
                              setNotAvailableDocs(prev => { const n = { ...prev }; delete n[docType]; return n; });
                            } else {
                              setNotAvailableDocs(prev => ({ ...prev, [docType]: true }));
                              setUploadedFiles(prev => { const n = { ...prev }; delete n[docType]; return n; });
                            }
                          }}
                          className="text-xs px-2 py-1 rounded-md border transition-colors"
                          style={{
                            borderColor: isNotAvailable ? 'rgb(239,68,68)' : 'var(--border)',
                            color: isNotAvailable ? 'rgb(239,68,68)' : 'inherit',
                            opacity: 0.8,
                          }}
                          title="Mark this document as not available"
                        >
                          {isNotAvailable ? 'Undo' : 'Not Available'}
                        </button>
                      </div>
                    </div>

                    {isNotAvailable ? (
                      <div className="border-2 border-dashed rounded-lg p-4 text-center" style={{ borderColor: 'rgb(239,68,68)', backgroundColor: 'rgba(239,68,68,0.04)' }}>
                        <div className="text-sm opacity-70">This document is marked as not available and will be visible to the client.</div>
                      </div>
                    ) : (
                    <label 
                      className="block cursor-pointer"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDraggedOver(docType);
                      }}
                      onDragLeave={() => setDraggedOver(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDraggedOver(null);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          setUploadedFiles(prev => ({ ...prev, [docType]: file }));
                        }
                      }}
                    >
                      <div 
                        className="border-2 border-dashed rounded-lg p-6 text-center transition-all hover:border-opacity-60 hover:bg-opacity-50" 
                        style={{ 
                          borderColor: draggedOver === docType ? 'var(--gold-accent)' : 'var(--border)', 
                          backgroundColor: draggedOver === docType ? 'rgba(212, 175, 55, 0.1)' : 'var(--background)',
                          transform: draggedOver === docType ? 'scale(1.02)' : 'scale(1)'
                        }}
                      >
                        {uploadedFiles[docType] ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2 text-sm font-medium" style={{ color: 'var(--gold-accent)' }}>
                              <File className="w-5 h-5" />
                              <span>{uploadedFiles[docType].name}</span>
                            </div>
                            <div className="text-xs opacity-60">
                              {(uploadedFiles[docType].size / 1024).toFixed(1)} KB
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setUploadedFiles(prev => {
                                  const newFiles = { ...prev };
                                  delete newFiles[docType];
                                  return newFiles;
                                });
                              }}
                              className="text-xs text-red-600 hover:text-red-700 underline mt-2"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="w-8 h-8 mx-auto opacity-40" />
                            <div className="text-sm font-medium opacity-70">
                              Click to upload or drag and drop
                            </div>
                            <div className="text-xs opacity-50">
                              PDF, DOC, DOCX, JPG, PNG (max 10MB)
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUploadedFiles(prev => ({ ...prev, [docType]: file }));
                          }
                        }}
                      />
                    </label>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            {!showAssessmentForm ? (
              <div className="flex gap-3 justify-end pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadForm(false);
                    setUploadedFiles({});
                  }}
                  className="px-5 py-2.5 rounded-md border text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Back
                </button>
                {needsAssessment ? (
                  <button
                    type="button"
                    onClick={onProceedToAssessment}
                    className="px-5 py-2.5 rounded-md text-sm transition-colors duration-150"
                    style={{ backgroundColor: 'var(--gold-accent)', color: 'var(--navy-deep)', fontWeight: 600 }}
                  >
                    Next: Assessment and Exit Note
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onSubmit()}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-md text-sm transition-colors duration-150 disabled:opacity-60"
                    style={{ backgroundColor: 'var(--gold-accent)', color: 'var(--navy-deep)', fontWeight: 600 }}
                  >
                    {submitting ? 'Saving…' : 'Register Cargo'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border-t pt-6" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Customs Clearance Documents</h3>
                      <p className="text-sm opacity-60 mt-1">Upload WH7, Assessment, Draft, T1, and Exit Note documents.</p>
                    </div>
                    <div className="text-sm font-medium px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--gold-accent)', color: 'var(--navy-deep)' }}>
                      {(wh7File ? 1 : 0) + (assessmentFile ? 1 : 0) + (draftFile ? 1 : 0) + (t1File ? 1 : 0) + (exitNoteFile ? 1 : 0)} / 5 files
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* WH7 */}
                    {renderFileUpload('WH7', wh7File, setWh7File)}
                    
                    {/* Assessment */}
                    {renderFileUpload('Assessment', assessmentFile, setAssessmentFile)}
                    
                    {/* Draft */}
                    {renderFileUpload('Draft', draftFile, setDraftFile)}
                    
                    {/* T1 */}
                    {renderFileUpload('T1', t1File, setT1File)}
                    
                    {/* Exit Note */}
                    {renderFileUpload('Exit Note', exitNoteFile, setExitNoteFile)}
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAssessmentForm(false)}
                    className="px-5 py-2.5 rounded-md border text-sm"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSubmit()}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-md text-sm transition-colors duration-150 disabled:opacity-60"
                    style={{ backgroundColor: 'var(--gold-accent)', color: 'var(--navy-deep)', fontWeight: 600 }}
                  >
                    {submitting ? 'Saving…' : 'Register Cargo'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-lg border border-red-300 bg-red-50 text-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-sm mb-1">Registration Error</div>
                <div className="text-sm">{error}</div>
                {error.includes('already exists') && (
                  <a
                    href={`/cargo/${selectedCargoId}`}
                    className="inline-block mt-2 text-sm font-medium underline hover:no-underline"
                  >
                    View existing cargo →
                  </a>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        {success && (
          <div className="mt-4 p-4 rounded-lg border border-green-300 bg-green-50 text-green-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-sm mb-1">Success!</div>
                <div className="text-sm">{success}</div>
              </div>
              <button
                onClick={() => setSuccess(null)}
                className="text-green-600 hover:text-green-800"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
