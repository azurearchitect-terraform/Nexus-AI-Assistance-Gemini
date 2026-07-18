use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct CostEstimate {
    pub token_count: usize,
    pub estimated_cost_usd: f64,
}

#[tauri::command]
pub async fn estimate_openai_cost(transcript_text: String) -> Result<CostEstimate, String> {
    let bpe = tiktoken::encoding_for_model("gpt-4o-mini").ok_or_else(|| "Model encoding not found".to_string())?;
    
    // Fallback/Option depending on crate signature.
    // Assuming bpe encodes to tokens.
    let tokens = bpe.encode_with_special_tokens(&transcript_text);
    let token_count = tokens.len();

    // The cost for gpt-4o-mini is $0.15 per 1,000,000 tokens
    let estimated_cost_usd = (token_count as f64 / 1_000_000.0) * 0.15;

    Ok(CostEstimate {
        token_count,
        estimated_cost_usd,
    })
}
