"""Calculate monthly income volatility and save it to stored analytics."""

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


def calculate_volatility(values):
    if len(values) < 2:
        return 0.0

    average_income = mean(values)
    if average_income == 0:
        return 0.0

    return round(max(0.0, (pstdev(values) / average_income) * 100), 2)


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
                volatility = calculate_volatility(income_values(income_data))
                cursor.execute(
                    'UPDATE "Analytics" SET "IncomeVolatility" = %s WHERE "userId" = %s',
                    (volatility, user_id),
                )
                updated_rows += 1

    print(f"Updated income volatility for {updated_rows} analytics row(s).")


if __name__ == "__main__":
    main()
