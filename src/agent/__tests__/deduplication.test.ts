import { generateJobHash } from '../utils/deduplication'

describe('Deduplication Utils', () => {
  describe('generateJobHash', () => {
    it('should generate consistent hash for same input', () => {
      const hash1 = generateJobHash('job123', 'gupy')
      const hash2 = generateJobHash('job123', 'gupy')
      
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA256 produces 64 char hex string
    })

    it('should generate different hashes for different externalIds', () => {
      const hash1 = generateJobHash('job123', 'gupy')
      const hash2 = generateJobHash('job456', 'gupy')
      
      expect(hash1).not.toBe(hash2)
    })

    it('should generate different hashes for different platforms', () => {
      const hash1 = generateJobHash('job123', 'gupy')
      const hash2 = generateJobHash('job123', 'indeed-br')
      
      expect(hash1).not.toBe(hash2)
    })

    it('should handle special characters', () => {
      const hash = generateJobHash('job/123?foo=bar', 'platform-name')
      
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })
  })
})
