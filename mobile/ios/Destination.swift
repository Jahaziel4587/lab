import Foundation

enum Destination: String, CaseIterable, Identifiable {
    case placeOrder = "place-order"
    case record
    case cart
    case inspections

    var id: String { rawValue }

    var title: String {
        switch self {
        case .placeOrder: "Place Order"
        case .record: "Record"
        case .cart: "Crear carrito"
        case .inspections: "Inspecciones"
        }
    }

    var icon: String {
        switch self {
        case .placeOrder: "shippingbox"
        case .record: "calendar"
        case .cart: "cart.badge.plus"
        case .inspections: "checklist"
        }
    }

    var route: String {
        switch self {
        case .placeOrder: "/hacer-pedido/proyecto"
        case .record: "/calendario"
        case .cart: "/inventario/movimientos?site=B1&tab=cart"
        case .inspections: "/inspecciones"
        }
    }

    var deepLink: URL {
        URL(string: "bioana-shortcuts://open/\(rawValue)")!
    }

    init?(deepLink: URL) {
        guard deepLink.scheme == "bioana-shortcuts", deepLink.host == "open" else { return nil }
        self.init(rawValue: String(deepLink.path.dropFirst()))
    }
}
