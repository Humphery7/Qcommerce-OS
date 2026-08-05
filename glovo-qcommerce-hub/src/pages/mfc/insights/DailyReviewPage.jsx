import AiReviewView from '../../../components/mfc/insights/AiReviewView';
import { useMfcDailyReview, useRegenerateDailyReview } from '../../../api/mfc';

export default function DailyReviewPage() {
  const { data, isLoading, isError, error, refetch } = useMfcDailyReview();
  const regenerate = useRegenerateDailyReview();

  return (
    <AiReviewView
      title="Daily Review"
      breadcrumbLabel="Daily Review"
      noun="daily review"
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
