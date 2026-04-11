import Anthropic from '@anthropic-ai/sdk'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin'
import logger from '../utils/logger'
import type { RawJob, UserProfile, MatchDetails } from '@/types'

const client = new Anthropic()

type Tone = 'formal' | 'moderate' | 'casual'

const FORMAL_KEYWORDS = ['banco', 'bank', 'consultoria', 'consulting', 'governo', 'government', 'trainee', 'bradesco', 'itaú', 'santander']
const CASUAL_KEYWORDS = ['startup', 'early-stage', 'seed', 'série a', 'series a', 'early stage', 'agile', 'scrum master']

function detectTone(description: string): Tone {
  const lower = description.toLowerCase()
  if (FORMAL_KEYWORDS.some((k) => lower.includes(k))) return 'formal'
  if (CASUAL_KEYWORDS.some((k) => lower.includes(k))) return 'casual'
  return 'moderate'
}

function detectLanguage(text: string): 'en' | 'pt' {
  const englishWords = text.match(/\b(the|and|for|with|you|our|your|we|are|is|in|to|of)\b/gi) ?? []
  const portugueseWords = text.match(/\b(para|com|que|uma|são|você|nossa|nosso|em|de|do|da)\b/gi) ?? []
  return englishWords.length > portugueseWords.length ? 'en' : 'pt'
}

function buildPrompt(profile: UserProfile, job: RawJob, matchDetails: MatchDetails, tone: Tone, lang: 'en' | 'pt'): string {
  const toneInstruction = {
    formal: lang === 'pt' ? 'linguagem profissional e respeitosa' : 'professional and respectful language',
    casual: lang === 'pt' ? 'linguagem direta e moderna, sem perder profissionalismo' : 'direct and modern language, without losing professionalism',
    moderate: lang === 'pt' ? 'equilíbrio entre profissional e acessível' : 'balance between professional and accessible',
  }[tone]

  if (lang === 'pt') {
    return `Você é um especialista em candidaturas de emprego em tecnologia.

Escreva uma carta de apresentação para a candidatura abaixo.

## CANDIDATO
Nome: ${profile.personal.fullName}
Cargo desejado: ${profile.objective.desiredRole}
Principais conquistas: ${matchDetails.positives.join(' | ')}
Resumo: ${profile.objective.professionalSummary}

## VAGA
Empresa: ${job.company}
Cargo: ${job.title}
Descrição: ${job.description.substring(0, 800)}

## INSTRUÇÕES
- Tom: ${tone} (${toneInstruction})
- Idioma: Português
- Máximo de 250 palavras
- 3 parágrafos: abertura (por que essa empresa), corpo (conquistas relevantes), fechamento
- NÃO usar clichês como "apaixonado por tecnologia", "aprendizado contínuo", "vestir a camisa"
- Ser específico: mencionar tecnologias, números, resultados reais
- Primeira pessoa
- NÃO incluir data, endereço, saudações — apenas o corpo da carta

Responda APENAS com o texto da carta.`
  }

  return `You are a job application specialist in technology.

Write a cover letter for the application below.

## CANDIDATE
Name: ${profile.personal.fullName}
Desired role: ${profile.objective.desiredRole}
Main achievements: ${matchDetails.positives.join(' | ')}
Summary: ${profile.objective.professionalSummary}

## JOB
Company: ${job.company}
Title: ${job.title}
Description: ${job.description.substring(0, 800)}

## INSTRUCTIONS
- Tone: ${tone} (${toneInstruction})
- Language: English
- Maximum 250 words
- 3 paragraphs: opening (why this company), body (relevant achievements), closing
- NO clichés like "passionate about technology", "continuous learning", "go the extra mile"
- Be specific: mention technologies, numbers, real results
- First person
- DO NOT include date, address, greetings — only the letter body

Reply ONLY with the letter text.`
}

export async function generateCoverLetter(
  userId: string,
  jobId: string,
  job: RawJob,
  profile: UserProfile,
  matchDetails: MatchDetails
): Promise<string> {
  const tone = detectTone(job.description)
  const lang = detectLanguage(job.description)

  let text: string
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: buildPrompt(profile, job, matchDetails, tone, lang) }],
    })
    text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  } catch (err) {
    logger.warn('cover_letter_error', { userId, jobId, error: String(err) })
    text = lang === 'pt'
      ? `Prezados recrutadores da ${job.company},\n\nMeu perfil como ${profile.objective.desiredRole} com experiência em ${profile.skills.technical.slice(0, 3).map((s) => s.name).join(', ')} está alinhado com os requisitos da vaga de ${job.title}.\n\nAgradeço a oportunidade e fico à disposição para conversar.\n\n${profile.personal.fullName}`
      : `Dear ${job.company} team,\n\nMy background as ${profile.objective.desiredRole} with experience in ${profile.skills.technical.slice(0, 3).map((s) => s.name).join(', ')} aligns with the ${job.title} role requirements.\n\nThank you for your consideration.\n\n${profile.personal.fullName}`
  }

  // Save to Firestore
  await adminDb.doc(`users/${userId}/applications/${jobId}`).set(
    {
      coverLetterText: text,
      coverLetterGeneratedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  logger.info('cover_letter_generated', { userId, jobId, tone, lang })
  return text
}
