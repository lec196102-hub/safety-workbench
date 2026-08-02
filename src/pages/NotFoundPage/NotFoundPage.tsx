import { Link } from "react-router-dom";
import uiText from '@/data/ui-text.json';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h1 className="text-6xl font-bold mb-4">{uiText.notFound.code}</h1>
      <p className="text-lg text-muted-foreground mb-8">{uiText.notFound.message}</p>
      <Link to="/" className="text-primary hover:underline">{uiText.notFound.action}</Link>
    </div>
  );
}
