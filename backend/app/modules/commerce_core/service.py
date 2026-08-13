from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.commerce_core.models import CommerceItem, CommerceOrder, CommerceOrderItem
from app.modules.commerce_core.schemas import CommerceOrderCreate, PublicCommerceOrderCreate


def generate_order_number() -> str:
    return f"ORD-{uuid4().hex[:10].upper()}"


def calculate_line_total(quantity: int, unit_amount: Decimal) -> Decimal:
    return Decimal(quantity) * unit_amount


def calculate_order_totals(
    items: list[CommerceOrderItem],
    *,
    discount_amount: Decimal,
    tax_amount: Decimal,
) -> tuple[Decimal, Decimal]:
    subtotal = sum((item.line_total_amount for item in items), Decimal("0"))
    total = subtotal - discount_amount + tax_amount
    if total < 0:
        raise ValueError("total_amount cannot be negative.")
    return subtotal, total


def create_order_from_payload(db: Session, payload: CommerceOrderCreate) -> CommerceOrder:
    order = CommerceOrder(
        order_number=generate_order_number(),
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        status=payload.status,
        fulfillment_status=payload.fulfillment_status,
        subtotal_amount=Decimal("0"),
        discount_amount=payload.discount_amount,
        tax_amount=payload.tax_amount,
        total_amount=Decimal("0"),
        currency=payload.currency,
        source=payload.source,
        notes=payload.notes,
    )
    db.add(order)
    db.flush()

    order_items: list[CommerceOrderItem] = []
    for item_payload in payload.items:
        line_total = calculate_line_total(item_payload.quantity, item_payload.unit_amount)
        order_item = CommerceOrderItem(
            order_id=order.id,
            commerce_item_id=item_payload.commerce_item_id,
            item_name=item_payload.item_name,
            item_type=item_payload.item_type,
            quantity=item_payload.quantity,
            unit_amount=item_payload.unit_amount,
            line_total_amount=line_total,
            currency=item_payload.currency,
            linked_service_id=item_payload.linked_service_id,
            session_credit_count=item_payload.session_credit_count,
            sort_order=item_payload.sort_order,
        )
        db.add(order_item)
        order_items.append(order_item)

    subtotal, total = calculate_order_totals(
        order_items,
        discount_amount=payload.discount_amount,
        tax_amount=payload.tax_amount,
    )
    order.subtotal_amount = subtotal
    order.total_amount = total

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def create_public_order_from_payload(db: Session, payload: PublicCommerceOrderCreate) -> CommerceOrder:
    requested_ids = [item.commerce_item_id for item in payload.items]
    catalog_items = db.scalars(
        select(CommerceItem).where(
            CommerceItem.id.in_(requested_ids),
            CommerceItem.is_published.is_(True),
        )
    ).all()
    catalog_by_id = {item.id: item for item in catalog_items}

    if len(catalog_by_id) != len(requested_ids):
        raise ValueError("One or more cart items are unavailable.")

    currencies = {item.currency for item in catalog_items}
    if len(currencies) != 1:
        raise ValueError("All cart items must use the same currency.")

    for requested_item in payload.items:
        catalog_item = catalog_by_id[requested_item.commerce_item_id]
        if catalog_item.stock_quantity is not None and requested_item.quantity > catalog_item.stock_quantity:
            raise ValueError("One or more cart items do not have enough stock.")

    requested_total = sum(
        (
            calculate_line_total(
                requested_item.quantity,
                catalog_by_id[requested_item.commerce_item_id].price_amount,
            )
            for requested_item in payload.items
        ),
        Decimal("0"),
    )
    if requested_total <= 0:
        raise ValueError("Cart total must be greater than zero.")

    currency = currencies.pop()
    order = CommerceOrder(
        order_number=generate_order_number(),
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        status="pending_payment",
        fulfillment_status="unfulfilled",
        subtotal_amount=Decimal("0"),
        discount_amount=Decimal("0"),
        tax_amount=Decimal("0"),
        total_amount=Decimal("0"),
        currency=currency,
        source="public_checkout",
        notes=payload.notes,
    )
    db.add(order)
    db.flush()

    order_items: list[CommerceOrderItem] = []
    for index, requested_item in enumerate(payload.items):
        catalog_item = catalog_by_id[requested_item.commerce_item_id]
        line_total = calculate_line_total(requested_item.quantity, catalog_item.price_amount)
        order_item = CommerceOrderItem(
            order_id=order.id,
            commerce_item_id=catalog_item.id,
            item_name=catalog_item.name,
            item_type=catalog_item.item_type,
            quantity=requested_item.quantity,
            unit_amount=catalog_item.price_amount,
            line_total_amount=line_total,
            currency=catalog_item.currency,
            linked_service_id=catalog_item.linked_service_id,
            session_credit_count=catalog_item.session_credit_count,
            sort_order=index,
        )
        db.add(order_item)
        order_items.append(order_item)

    subtotal, total = calculate_order_totals(
        order_items,
        discount_amount=Decimal("0"),
        tax_amount=Decimal("0"),
    )
    order.subtotal_amount = subtotal
    order.total_amount = total
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def get_order_with_items(db: Session, order_id: str) -> tuple[CommerceOrder | None, list[CommerceOrderItem]]:
    order = db.scalar(select(CommerceOrder).where(CommerceOrder.id == order_id))
    if order is None:
        return None, []

    items = db.scalars(
        select(CommerceOrderItem)
        .where(CommerceOrderItem.order_id == order_id)
        .order_by(CommerceOrderItem.sort_order, CommerceOrderItem.created_at)
    ).all()
    return order, items


def attach_items(order: CommerceOrder, items: list[CommerceOrderItem]) -> CommerceOrder:
    setattr(order, "items", items)
    return order
