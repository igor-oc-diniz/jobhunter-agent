import { getRawJobsAction } from '@/app/actions/jobs'
import { JobsPanel } from '@/components/dashboard/JobsPanel'

export default async function JobsPage() {
  const jobs = await getRawJobsAction()

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-headline font-bold tracking-tight text-primary">
          Jobs Found
        </h1>
        <p className="text-on-surface-variant text-sm mt-2">
          {jobs.length} vagas coletadas pelos scrapers
        </p>
      </div>

      <JobsPanel jobs={jobs} />
    </div>
  )
}
