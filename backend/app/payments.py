"""
Payment integration module.

Payme va Click integratsiyasi keyingi bosqichda shu modul orqali
amalga oshiriladi.

Muhim:
- Payment tasdiqlanmaguncha order PAID bo'lmaydi.
- Payment tasdiqlanganda stock orders.py ichidagi
  confirm_payment() orqali kamaytiriladi.
- Transaction ID orqali takroriy payment tasdiqlanishining
  oldi olinadi.
"""