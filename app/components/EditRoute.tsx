'use client';

import { useSearchParams } from 'next/navigation';

import GenogramEditor from './GenogramEditor';

export default function EditRoute() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  return <GenogramEditor key={projectId ?? 'missing-project'} projectId={projectId} />;
}
