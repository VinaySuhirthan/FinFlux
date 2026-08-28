"""Calculate average income and predicted-income difference for stored analytics."""

import json
import os
from statistics import mean

import psycopg2


def load_env_file():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"'))


def income_values(income_data):
    if isinstance(income_data, str):
        income_data = json.loads(income_data)

    return [
        float(values.get("income", 0))
        for values in (income_data or {}).values()
        if isinstance(values, dict)
    ]


def calculate_values(income_data, predicted_income):
    values = income_values(income_data)
    average_income = mean(values) if values else 0.0
    predicted = float(predicted_income or 0)
    return round(average_income, 2), round(predicted - average_income, 2)


def main():
    load_env_file()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    with psycopg2.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute('SELECT "userId", "income", "PredictedIncome" FROM "Analytics"')
            rows = cursor.fetchall()

    for user_id, income_data, predicted_income in rows:
        average_income, amount_saved = calculate_values(income_data, predicted_income)
        print(
            f"{user_id}: average income={average_income:.2f}, "
            f"amount saved={amount_saved:.2f}"
        )

    print(f"Calculated income outlook for {len(rows)} analytics row(s).")


if __name__ == "__main__":
    main()
