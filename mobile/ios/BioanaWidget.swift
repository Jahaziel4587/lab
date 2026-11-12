import SwiftUI
import WidgetKit

struct ShortcutEntry: TimelineEntry {
    let date: Date
}

struct ShortcutProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShortcutEntry { ShortcutEntry(date: .now) }

    func getSnapshot(in context: Context, completion: @escaping (ShortcutEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShortcutEntry>) -> Void) {
        completion(Timeline(entries: [placeholder(in: context)], policy: .never))
    }
}

@main
struct BioanaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "BioanaShortcuts", provider: ShortcutProvider()) { _ in
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(Destination.allCases) { destination in
                    Link(destination: destination.deepLink) {
                        Label(destination.title, systemImage: destination.icon)
                            .font(.subheadline.weight(.semibold))
                            .minimumScaleFactor(0.75)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                            .padding(.horizontal, 8)
                            .background(.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                    }
                    .foregroundStyle(.primary)
                }
            }
            .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Accesos de Bioana")
        .description("Abre Place Order, Record, el carrito o Inspecciones.")
        .supportedFamilies([.systemMedium])
    }
}
