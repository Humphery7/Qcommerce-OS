import AiReviewView from '../../../components/mfc/insights/AiReviewView';
import { useMfcMonthlyReview, useRegenerateMonthlyReview } from '../../../api/mfc';

export default function MonthlyReviewPage() {
  const { data, isLoading, isError, error, refetch } = useMfcMonthlyReview();
  const regenerate = useRegenerateMonthlyReview();

  return (
    <AiReviewView
      title="Monthly Review"
      breadcrumbLabel="Monthly Review"
      noun="monthly review"
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
