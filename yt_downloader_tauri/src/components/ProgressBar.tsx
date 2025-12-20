/** Progress bar component */

import type { DownloadProgress } from "../types";

interface ProgressBarProps {
    progress: DownloadProgress;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
    return (
        <div className="progress-section">
            <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="progress-info">
                <span>{progress.percent.toFixed(1)}%</span>
                {progress.speed && <span>{progress.speed}</span>}
                {progress.eta && <span>ETA: {progress.eta}</span>}
            </div>
        </div>
    );
};
