from django.urls import path
from . import views

urlpatterns = [
    path("overview/", views.overview, name="analytics-overview"),
    path("entries-by-date/", views.entries_by_date, name="analytics-entries-by-date"),
    path("entries-by-gate/", views.entries_by_gate, name="analytics-entries-by-gate"),
    path("peak-hours/", views.peak_hours, name="analytics-peak-hours"),
    path("delivery-stats/", views.delivery_stats, name="analytics-delivery-stats"),
]
