import SwiftUI
import WebKit

@main
struct BioanaApp: App {
    @State private var webView = WKWebView()

    private var baseURL: URL? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "BioanaBaseURL") as? String,
              let components = URLComponents(string: value),
              components.scheme == "https", components.host != nil,
              components.user == nil, components.password == nil,
              components.query == nil, components.fragment == nil,
              components.path.isEmpty || components.path == "/"
        else { return nil }
        return components.url
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if let baseURL {
                    PlatformView(webView: webView)
                        .onAppear {
                            if webView.url == nil && !webView.isLoading {
                                webView.load(URLRequest(url: baseURL))
                            }
                        }
                } else {
                    ContentUnavailableView("Configura el dominio de Bioana",
                                           systemImage: "gearshape",
                                           description: Text("Define BIOANA_BASE_URL en el proyecto de iOS."))
                }
            }
            .onOpenURL { link in
                guard let destination = Destination(deepLink: link),
                      let baseURL,
                      let url = URL(string: destination.route, relativeTo: baseURL)?.absoluteURL
                else { return }
                webView.load(URLRequest(url: url))
            }
        }
    }
}

struct PlatformView: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView { webView }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
