import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
      <span className="material-symbols-outlined text-[40px] text-outline">explore_off</span>
      <div>
        <h1 className="text-[18px] font-semibold text-on-surface">Page not found</h1>
        <p className="text-[12px] text-secondary mt-1">That workspace or tool doesn't exist.</p>
      </div>
      <Link to="/"><Button variant="primary">Back to Home</Button></Link>
    </div>
  );
}
