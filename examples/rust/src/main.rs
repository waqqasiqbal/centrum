use reqwest::blocking::Client;
use serde_json::json;
use std::env;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let base = env::var("CENTRUM_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".into());
    let key = env::var("CENTRUM_API_KEY").expect("set CENTRUM_API_KEY first");
    let client = Client::new();
    let live = client.post(format!("{base}/v1/execute"))
        .header("x-ai-interface-key", &key)
        .json(&json!({"instruction": "Return my in-stock products under 100 EUR as JSON"}))
        .send()?.error_for_status()?.text()?;
    println!("{live}");

    let slug = "rust-featured-products";
    client.post(format!("{base}/v1/persisted-apis"))
        .header("x-ai-interface-key", &key)
        .header("idempotency-key", format!("{slug}-v1"))
        .json(&json!({"slug": slug, "instruction": "Return my first three products as JSON"}))
        .send()?.error_for_status()?;
    let persisted = client.get(format!("{base}/v1/persisted/{slug}"))
        .header("x-ai-interface-key", &key)
        .send()?.error_for_status()?.text()?;
    println!("persisted response without another LLM call:\n{persisted}");
    Ok(())
}
