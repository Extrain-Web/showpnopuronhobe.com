import Leaderboard from '@/components/mlm/Leaderboard';

export const metadata = { title: 'Leaderboard' };

export default function LeaderboardPage() {
    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <Leaderboard />
        </div>
    );
}
