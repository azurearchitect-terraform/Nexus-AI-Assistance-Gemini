import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CostEstimatorProps {
    transcript: string;
}

interface CostEstimateResult {
    token_count: number;
    estimated_cost_usd: number;
}

export const CostEstimator: React.FC<CostEstimatorProps> = ({ transcript }) => {
    const [tokenCount, setTokenCount] = useState<number>(0);
    const [estimatedCostUsd, setEstimatedCostUsd] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!transcript || transcript.trim() === '') {
            setTokenCount(0);
            setEstimatedCostUsd(0);
            return;
        }

        const estimateCost = async () => {
            try {
                const result = await invoke<CostEstimateResult>('estimate_openai_cost', { transcriptText: transcript });
                setTokenCount(result.token_count);
                setEstimatedCostUsd(result.estimated_cost_usd);
                setError(null);
            } catch (err: any) {
                console.error("Cost estimation failed:", err);
                setError("Err");
            }
        };

        const timeout = setTimeout(estimateCost, 500);
        return () => clearTimeout(timeout);
    }, [transcript]);

    if (tokenCount === 0 && !error) return null;

    const estimatedCostInr = estimatedCostUsd * 83.5;

    return (
        <div className="flex flex-col items-end justify-center text-[9px] text-muted-foreground px-1.5 py-0.5 rounded-sm bg-muted/20 border border-border/30 shadow-sm leading-tight">
            {error ? (
                <span className="text-red-500">Error</span>
            ) : (
                <>
                    <span className="font-mono">{tokenCount.toLocaleString()} tk</span>
                    <span className="font-mono text-emerald-600/90 dark:text-emerald-400/90">₹{estimatedCostInr.toFixed(4)}</span>
                </>
            )}
        </div>
    );
};
