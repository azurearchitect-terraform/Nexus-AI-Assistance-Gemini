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
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-2 py-1 bg-muted/50 rounded-md border border-border/50">
            {error ? (
                <span className="text-red-500">Cost error</span>
            ) : (
                <>
                    <div className="flex items-center gap-1">
                        <span className="font-semibold">Tokens:</span>
                        <span>{tokenCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-600/90 dark:text-emerald-400/90">
                        <span className="font-semibold">Cost:</span>
                        <span>${estimatedCostUsd.toFixed(6)} (₹{estimatedCostInr.toFixed(4)})</span>
                    </div>
                </>
            )}
        </div>
    );
};
