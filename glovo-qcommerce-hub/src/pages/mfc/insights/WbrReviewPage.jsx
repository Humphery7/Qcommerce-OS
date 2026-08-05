import AiReviewView from '../../../components/mfc/insights/AiReviewView';
import { useMfcWbrReview, useRegenerateWbrReview } from '../../../api/mfc';

export default function WbrReviewPage() {
  const { data, isLoading, isError, error, refetch } = useMfcWbrReview();
  const regenerate = useRegenerateWbrReview();

  return (
    <AiReviewView
      title="WBR Review"
      breadcrumbLabel="WBR Review"
      noun="WBR review"
      data={data}
      isLoading={isLoading}
      isError={isError}
      error={error}
      refetch={refetch}
      onRegenerate={() => regenerate.mutate()}
      isRegenerating={regenerate.isPending}
    />
  );
}
