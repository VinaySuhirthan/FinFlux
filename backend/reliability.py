"""Calculate income reliability and save it to stored analytics."""

import json
import os
from statistics import mean, pstdev

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


def calculate_reliability(values):
    if not values:
        return 0.0

    average_income = mean(values)
    if average_income <= 0:
        return 0.0

    if len(values) < 2:
        return 100.0

    volatility = (pstdev(values) / average_income) * 100
    return round(min(100.0, max(0.0, 100.0 - volatility)), 2)


def main():
    load_env_file()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    updated_rows = 0
    with psycopg2.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute('SELECT "userId", "income" FROM "Analytics"')
            rows = cursor.fetchall()

            for user_id, income_data in rows:
                reliability = calculate_reliability(income_values(income_data))
                cursor.execute(
                    'UPDATE "Analytics" SET "IncomeReliability" = %s WHERE "userId" = %s',
                    (reliability, user_id),
                )
                updated_rows += 1

    print(f"Updated income reliability for {updated_rows} analytics row(s).")


if __name__ == "__main__":
    main()
