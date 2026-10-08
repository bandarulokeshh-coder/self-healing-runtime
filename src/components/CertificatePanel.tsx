import { useState } from 'react'
import { useCertificateStore, verifyCertificate, type RecoveryCertificate } from '../core/Certificate'

const shortHash = (h: string) => `${h.slice(0, 8)}…`

function CertificateCard({ cert }: { cert: RecoveryCertificate }) {
  const [expanded, setExpanded] = useState(false)
  const [result, setResult] = useState<{ valid: boolean; reasons: string[] } | null>(null)

  return (
    <article className="dashboard-card certificate-card">
      <div className="component-heading">
        <div className="component-heading-copy">
          <span className={`component-icon ${cert.verified ? 'component-icon-violet' : 'component-icon-amber'}`} aria-hidden="true">
            {cert.verified ? '✓' : '!'}
          </span>
          <div>
            <h3>{cert.id}</h3>
            <p>
              {cert.errorClass.replace(/_/g, ' ')} · loss window {cert.lossWindowMs}ms · recovery {cert.recoveryDurationMs}ms
            </p>
          </div>
        </div>
        <span className={`component-tag ${cert.verified ? 'certificate-verified' : 'certificate-failed'}`}>
          {cert.verified ? 'VERIFIED' : 'FAILED'}
        </span>
      </div>

      <div className="certificate-invariants">
        {cert.invariants.map((inv) => (
          <span key={inv.name} className={`invariant-chip ${inv.passed ? 'invariant-pass' : 'invariant-fail'}`} title={inv.detail || ''}>
            {inv.passed ? '✓' : '✗'} {inv.name}
          </span>
        ))}
      </div>

      <div className="certificate-hashes">
        <span>post <code>{shortHash(cert.postStateHash)}</code></span>
        <span>cert <code>{shortHash(cert.certificateHash)}</code></span>
        <span>snapshot <code>{shortHash(cert.snapshotId)}</code></span>
      </div>

      {result && (
        <div className={`certificate-verify-result ${result.valid ? 'cert-valid' : 'cert-invalid'}`}>
          {result.valid
            ? '✓ Independently re-verified: hash chain intact, all invariants pass'
            : `✗ Verification failed: ${result.reasons.join('; ')}`}
        </div>
      )}

      <div className="certificate-actions">
        <button className="action-secondary" onClick={() => setResult(verifyCertificate(cert))}>
          Re-verify
        </button>
        <button className="action-secondary" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide JSON' : 'Show JSON'}
        </button>
      </div>

      {expanded && <pre className="certificate-json">{JSON.stringify(cert, null, 2)}</pre>}
    </article>
  )
}

export function CertificatePanel() {
  const certificates = useCertificateStore((s) => s.certificates)
  const [bulk, setBulk] = useState<string | null>(null)

  const verifyAll = () => {
    const results = certificates.map((c) => ({ id: c.id, ...verifyCertificate(c) }))
    const bad = results.filter((r) => !r.valid)
    setBulk(
      certificates.length === 0
        ? 'No certificates yet — trigger an error and recover.'
        : bad.length === 0
          ? `✓ All ${results.length} certificates independently verified.`
          : `✗ ${bad.length}/${results.length} failed: ${bad.map((b) => `${b.id} (${b.reasons.join('; ')})`).join(' | ')}`
    )
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(certificates, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'recovery-certificates.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="dashboard-section" aria-labelledby="certificates-heading">
      <div className="section-heading">
        <div>
          <div className="section-eyebrow">MACHINE-CHECKABLE GUARANTEES</div>
          <h2 id="certificates-heading">Recovery certificates</h2>
          <p>
            Every recovery issues a self-signed certificate: state hashes, per-invariant results, and a loss-window bound.
            Verify offline with <code>node scripts/verify-certificates.mjs recovery-certificates.json</code>.
          </p>
        </div>
        <span className="section-caption">{certificates.length} issued</span>
      </div>

      {certificates.length === 0 ? (
        <div className="dashboard-card certificate-empty">
          <p>No certificates yet. Trigger a recovery scenario — a certificate is issued and verified on every restore.</p>
        </div>
      ) : (
        <div className="certificate-list">
          {certificates.map((c) => (
            <CertificateCard key={c.id} cert={c} />
          ))}
        </div>
      )}

      <div className="certificate-actions">
        <button className="action-primary" onClick={verifyAll} disabled={certificates.length === 0}>
          Verify all certificates
        </button>
        <button className="action-secondary" onClick={exportJson} disabled={certificates.length === 0}>
          Export JSON
        </button>
        {bulk && <span className="certificate-bulk-result">{bulk}</span>}
      </div>
    </section>
  )
}
