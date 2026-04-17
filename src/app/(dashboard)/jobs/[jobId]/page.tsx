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
import { ScoreBadge } from "@/components/design-system/atoms/ScoreBadge";
import { RawJobStatusBadge } from "@/components/design-system/atoms/RawJobStatusBadge";
import { Chip } from "@/components/design-system/atoms/Chip";
import { FormAssistant } from "@/components/dashboard/FormAssistant";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ jobId: string }>;
}

export default async function JobDetailPage({ params }: Props) {
  const { jobId } = await params;
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

          <button className="bg-surface-container-high hover:bg-surface-container-highest transition-all py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 border border-outline-variant/10 hover:scale-[1.01] active:scale-95">
            <FileText className="w-4 h-4 text-primary-container" />
            <span className="text-xs font-headline font-bold text-primary uppercase tracking-widest">
              Generate Custom CV
            </span>
          </button>

          <button className="bg-surface-container-high hover:bg-surface-container-highest transition-all py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 border border-outline-variant/10 hover:scale-[1.01] active:scale-95">
            <FileText className="w-4 h-4 text-secondary-container" />
            <span className="text-xs font-headline font-bold text-primary uppercase tracking-widest">
              Generate Cover Letter
            </span>
          </button>
        </div>

        {/* Mission Intelligence — job description collapsible */}
        <section className="bg-surface-container-low/60 backdrop-blur-[20px] rounded-2xl border border-outline-variant/10 overflow-hidden">
          <details className="group" open>
            <summary className="flex items-center justify-between p-6 cursor-pointer list-none hover:bg-white/5 transition-colors select-none">
              <h2 className="text-xl font-headline font-bold text-primary flex items-center gap-3">
                <Brain className="w-5 h-5 text-primary-container" />
                Job Description
              </h2>
              <svg
                className="w-5 h-5 text-on-surface-variant transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>

            <div className="px-8 pb-8 pt-2 border-t border-outline-variant/10">
              {descLines.length > 0 ? (
                <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <h3 className="text-primary font-bold uppercase tracking-widest text-[10px] opacity-60">
                      Activities
                    </h3>
                    <ul className="space-y-2 text-sm text-on-surface-variant font-medium">
                      {leftLines.map((line, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-primary-container rounded-full mt-1.5 shrink-0" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-primary font-bold uppercase tracking-widest text-[10px] opacity-60">
                      {reqLines.length > 0 ? "Protocols" : "Continued"}
                    </h3>
                    <ul className="space-y-2 text-sm text-on-surface-variant font-medium">
                      {(reqLines.length > 0 ? reqLines : rightLines).map(
                        (line, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-secondary-container rounded-full mt-1.5 shrink-0" />
                            {line}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-on-surface-variant text-sm">
                  No description available.
                </p>
              )}

              {/* Tech stack */}
              {job.techStack?.length > 0 && (
                <div className="mt-8 pt-6 border-t border-outline-variant/10">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-outline mb-4">
                    Tech Stack
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {job.techStack.map((tech) => (
                      <Chip key={tech} label={tech} />
                    ))}
                  </div>
                </div>
              )}

              {/* AI justification */}
              {details?.justification && (
                <div className="mt-6 p-4 bg-primary-container/5 rounded-xl border border-primary-container/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-container mb-2">
                    Agent Justification
                  </p>
                  <p className="text-sm text-on-surface-variant italic leading-relaxed">
                    &ldquo;{details.justification}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </details>
        </section>

        {/* Form Assistant */}
        <FormAssistant />
      </div>
    </div>
  );
}
