import { describe, it, expect } from 'vitest'
import { createSeed } from '../../app/data/seed'
import { artifactAnchor, renderPrototypeArtifact } from '../../server/services/prototype-artifacts'

describe('prototype artifacts', () => {
  it('uses versioned unambiguous anchors and genuine demo TXT/CSV formats', () => {
    const renta = createSeed().find(item => item.id === 'DEMO-R08')!
    renta.ph.note = 'PRIVATE-PH-NOTE'
    renta.tax.note = 'PRIVATE-TAX-NOTE'
    expect(artifactAnchor('ph', renta)).toBe(`v1:[${renta.ph.version}]`)
    renta.tax.receipt = 'a:b"c'
    renta.tax.presentationDate = '2026-06-12'
    expect(artifactAnchor('receipt', renta)).toBe(`v1:${JSON.stringify([renta.tax.receipt, renta.tax.presentationDate])}`)
    const ph = renderPrototypeArtifact('ph', renta)
    expect(ph.originalName).toMatch(/\.txt$/)
    expect(ph.mimeType).toBe('text/plain; charset=utf-8')
    expect(ph.bytes.toString()).toContain('FICTICIO')
    expect(ph.bytes.toString()).not.toContain(renta.ph.note)
    expect(renderPrototypeArtifact('tax-draft', renta).bytes.toString()).not.toContain(renta.tax.note)
    const item = createSeed().find(item => item.id === 'DEMO-72008')!
    item.extraction.rows[0]!.entity = '=HYPERLINK("external")'
    const extraction = renderPrototypeArtifact('extraction', item)
    expect(extraction.originalName).toMatch(/\.csv$/)
    expect(extraction.bytes.toString()).toContain('no XLSX ni importable en Criteria')
    expect(extraction.bytes.toString()).toContain("'=HYPERLINK")
    expect(extraction.bytes.toString()).toContain('""external""')
  })
})
