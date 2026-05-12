import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Building2,
  Brain,
  FileText,
  Send,
} from "lucide-react";
import { getRawJobAction } from "@/app/actions/jobs";
import { requireUserId } from "@/lib/auth/server";
import { ScoreBadge } from "@/components/design-system/atoms/ScoreBadge";
import { RawJobStatusBadge } from "@/components/design-system/atoms/RawJobStatusBadge";
import { Chip } from "@/components/design-system/atoms/Chip";
import { FormAssistant } from "@/components/dashboard/FormAssistant";
import { GenerateCVButton } from "@/components/dashboard/GenerateCVButton";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ jobId: string }>;
}

export default async function JobDetailPage({ params }: Props) {
  const { jobId } = await params;
  const userId = await requireUserId();
  const job = await getRawJobAction(jobId);

  if (!job) notFound();

  const hasScore = typeof job.matchScore === "number";
  const details = job.matchDetails;

  const salaryLabel =
    job.salaryMin || job.salaryMax
      ? `${job.salaryCurrency ?? "$"}${job.salaryMin ? `${Math.round(job.salaryMin / 1000)}k` : ""}${job.salaryMin && job.salaryMax ? " – " : ""}${job.salaryMax ? `${Math.round(job.salaryMax / 1000)}k` : ""}`
      : null;

  // Split description into two halves for the 2-column layout
  const descLines = (job.description ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const reqLines = (job.requirements ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const leftLines = descLines.slice(0, Math.ceil(descLines.length / 2));
  const rightLines = descLines.slice(Math.ceil(descLines.length / 2));

  return (
    <div className="min-h-full">
      {/* Back nav */}
      <div className="mb-8">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors text-sm font-label uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs
        </Link>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Hero card */}
        <section className="bg-surface-container-low/60 backdrop-blur-[20px] rounded-2xl p-8 border border-outline-variant/10 relative overflow-hidden">
          {/* Match score ring — top right */}
          {hasScore && (
            <div className="absolute top-8 right-8 flex flex-col items-center gap-1">
              <span className="text-[10px] font-headline uppercase tracking-[0.2em] text-primary-container/60 mb-1">
                Match Score
              </span>
              <ScoreBadge score={job.matchScore!} size="lg" />
            </div>
          )}

          <div className="flex items-start gap-6 pr-28">
            {/* Company avatar */}
            <div className="w-16 h-16 bg-surface-container-high rounded-xl flex items-center justify-center shrink-0 border border-outline-variant/10">
              <Building2 className="w-7 h-7 text-outline" />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-4xl font-headline font-bold text-primary tracking-tight mb-2 leading-tight">
                {job.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-on-surface-variant text-sm font-medium mb-4">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-secondary-container" />
                  {job.company}
                </span>
                {job.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-secondary-container" />
                    {job.location}
                    {job.isRemote && (
                      <span className="ml-1 bg-secondary-container/10 text-secondary-container text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        Remote
                      </span>
                    )}
                  </span>
                )}
                {salaryLabel && (
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-secondary-container" />
                    {salaryLabel}
                  </span>
                )}
              </div>

              {/* Match tags */}
              {details && (
                <div className="flex flex-col gap-2">
                  {details.positives?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-headline uppercase tracking-widest text-primary-container">
                        Positive:
                      </span>
                      {details.positives.slice(0, 4).map((item, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 bg-primary-container/10 text-primary-container text-[10px] rounded border border-primary-container/20 uppercase font-bold"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  {details.gaps?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-headline uppercase tracking-widest text-tertiary-fixed-dim">
                        Gaps:
                      </span>
                      {details.gaps.slice(0, 3).map((item, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim text-[10px] rounded border border-tertiary-fixed-dim/20 uppercase font-bold"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Badges */}
              <div className="flex items-center gap-3 mt-4">
                <RawJobStatusBadge status={job.status} />
                <span className="text-outline text-[10px] uppercase tracking-widest font-mono">
                  {job.sourcePlatform}
                </span>
                {job.contractType && job.contractType !== "unknown" && (
                  <span className="text-outline text-[10px] uppercase tracking-widest font-mono">
                    {job.contractType.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Action buttons */}
        <div className="grid gap-4 grid-cols-3">
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "bg-primary-container hover:bg-primary-fixed transition-all py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 border border-primary-container/20",
              "shadow-[0px_0px_20px_rgba(0,255,136,0.2)] hover:scale-[1.02] active:scale-95",
            )}
          >
            <Send className="w-4 h-4 text-on-primary-container" />
            <span className="text-xs font-headline font-bold text-on-primary-container uppercase tracking-widest">
              Apply Now
            </span>
          </a>

          <GenerateCVButton userId={userId} jobId={jobId} />

          <button className="bg-surface-container-high hover:bg-surface-container-highest transition-all py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 border border-outline-variant/10 hover:scale-[1.01] active:scale-95">
            <Brain className="w-4 h-4 text-primary-container" />
            <span className="text-xs font-headline font-bold text-primary uppercase tracking-widest">
              Generate Cover Letter
            </span>
          </button>
        </div>

        {/* Match analysis */}
        {details?.justification && (
          <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
            <h3 className="text-sm font-headline font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary-container" />
              AI Match Analysis
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {details.justification}
            </p>
          </section>
        )}

        {/* Description */}
        {descLines.length > 0 && (
          <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
            <h3 className="text-sm font-headline font-bold text-primary uppercase tracking-widest mb-4">
              Description
            </h3>
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-on-surface-variant leading-relaxed">
              <div className="space-y-3">
                {leftLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              <div className="space-y-3">
                {rightLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Requirements */}
        {reqLines.length > 0 && (
          <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
            <h3 className="text-sm font-headline font-bold text-primary uppercase tracking-widest mb-4">
              Requirements
            </h3>
            <ul className="space-y-2 text-sm text-on-surface-variant leading-relaxed">
              {reqLines.map((line, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-primary-container mt-1 shrink-0">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tech stack */}
        {job.techStack && job.techStack.length > 0 && (
          <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
            <h3 className="text-sm font-headline font-bold text-primary uppercase tracking-widest mb-4">
              Tech Stack
            </h3>
            <div className="flex flex-wrap gap-2">
              {job.techStack.map((tech) => (
                <Chip key={tech} label={tech} />
              ))}
            </div>
          </section>
        )}

        {/* Form assistant */}
        <FormAssistant />

        {/* Footer metadata */}
        <section className="bg-surface-container-low/40 rounded-2xl p-6 border border-outline-variant/5 text-xs text-on-surface-variant space-y-1 font-mono">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-outline uppercase tracking-widest">Scraped:</span>
            <span>
              {job.scrapedAt
                ? new Date(job.scrapedAt as unknown as string).toLocaleString()
                : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-outline uppercase tracking-widest">Job ID:</span>
            <span className="break-all">{job.id}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
