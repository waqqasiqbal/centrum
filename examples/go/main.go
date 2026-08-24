package main

import (
  "bytes"
  "fmt"
  "io"
  "net/http"
  "os"
)

func request(method, path, body, idempotencyKey string) ([]byte, error) {
  base := os.Getenv("CENTRUM_BASE_URL")
  if base == "" { base = "http://localhost:3000" }
  key := os.Getenv("CENTRUM_API_KEY")
  if key == "" { return nil, fmt.Errorf("set CENTRUM_API_KEY first") }
  req, err := http.NewRequest(method, base+path, bytes.NewBufferString(body))
  if err != nil { return nil, err }
  req.Header.Set("x-ai-interface-key", key)
  if body != "" { req.Header.Set("content-type", "application/json") }
  if idempotencyKey != "" { req.Header.Set("idempotency-key", idempotencyKey) }
  resp, err := http.DefaultClient.Do(req)
  if err != nil { return nil, err }
  defer resp.Body.Close()
  result, err := io.ReadAll(resp.Body)
  if err != nil { return nil, err }
  if resp.StatusCode >= 300 { return nil, fmt.Errorf("%s: %s", resp.Status, result) }
  return result, nil
}

func main() {
  live, err := request("POST", "/v1/execute", `{"instruction":"Return my in-stock products under 100 EUR as JSON"}`, "")
  if err != nil { panic(err) }
  fmt.Println(string(live))
  slug := "go-featured-products"
  if _, err = request("POST", "/v1/persisted-apis", `{"slug":"`+slug+`","instruction":"Return my first three products as JSON"}`, slug+"-v1"); err != nil { panic(err) }
  persisted, err := request("GET", "/v1/persisted/"+slug, "", "")
  if err != nil { panic(err) }
  fmt.Println("persisted response without another LLM call:")
  fmt.Println(string(persisted))
}
