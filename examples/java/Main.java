import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public final class Main {
  private static final String BASE_URL = System.getenv().getOrDefault("CENTRUM_BASE_URL", "http://localhost:3000");
  private static final String API_KEY = System.getenv("CENTRUM_API_KEY");

  private static String request(String method, String path, String body, String idempotencyKey) throws Exception {
    if (API_KEY == null || API_KEY.isBlank()) throw new IllegalStateException("Set CENTRUM_API_KEY first");
    var builder = HttpRequest.newBuilder(URI.create(BASE_URL + path))
        .header("x-ai-interface-key", API_KEY)
        .header("content-type", "application/json");
    if (idempotencyKey != null) builder.header("idempotency-key", idempotencyKey);
    builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
    var response = HttpClient.newHttpClient().send(builder.build(), HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) throw new IllegalStateException(response.statusCode() + ": " + response.body());
    return response.body();
  }

  public static void main(String[] args) throws Exception {
    System.out.println(request("POST", "/v1/execute",
        "{\"instruction\":\"Return my in-stock products under 100 EUR as JSON\"}", null));
    String slug = "java-featured-products";
    request("POST", "/v1/persisted-apis", "{\"slug\":\"" + slug + "\",\"instruction\":\"Return my first three products as JSON\"}", slug + "-v1");
    System.out.println("persisted response without another LLM call:");
    System.out.println(request("GET", "/v1/persisted/" + slug, null, null));
  }
}
