"""Train a Random Forest on stored monthly analytics and save income predictions."""

import json
import os
from datetime import datetime

import psycopg2
from sklearn.ensemble import RandomForestRegressor


LAG_MONTHS = 3


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


def as_json(value):
	if isinstance(value, str):
		return json.loads(value)
	return value or {}


def monthly_records(income_data):
	records = []
	for month, values in as_json(income_data).items():
		try:
			month_number = datetime.strptime(month, "%Y-%m").month
			records.append(
				{
					"month": month,
					"month_number": month_number,
					"income": float(values.get("income", 0)),
					"expense": float(values.get("expense", 0)),
				}
			)
		except (AttributeError, TypeError, ValueError):
			continue
	return sorted(records, key=lambda record: record["month"])


def features_for(records, target_index):
	history = records[target_index - LAG_MONTHS : target_index]
	if len(history) != LAG_MONTHS:
		return None

	target_month = records[target_index]["month_number"]
	return [
		*(record["income"] for record in history),
		*(record["expense"] for record in history),
		target_month,
	]


def build_training_data(rows):
	features = []
	targets = []
	histories = []

	for row in rows:
		records = monthly_records(row["income"])
		histories.append((row["user_id"], records))
		for target_index in range(LAG_MONTHS, len(records)):
			row_features = features_for(records, target_index)
			if row_features is not None:
				features.append(row_features)
				targets.append(records[target_index]["income"])

	return features, targets, histories


def predict_income(records, model):
	if not records:
		return 0.0

	if len(records) <= LAG_MONTHS:
		return round(sum(record["income"] for record in records) / len(records), 2)

	next_month = (records[-1]["month_number"] % 12) + 1
	prediction_features = [
		*(record["income"] for record in records[-LAG_MONTHS:]),
		*(record["expense"] for record in records[-LAG_MONTHS:]),
		next_month,
	]

	if model is None:
		return round(sum(record["income"] for record in records[-3:]) / 3, 2)

	return round(max(0.0, float(model.predict([prediction_features])[0])), 2)


def main():
	load_env_file()
	database_url = os.getenv("DATABASE_URL")
	if not database_url:
		raise RuntimeError("DATABASE_URL is not configured")

	with psycopg2.connect(database_url) as connection:
		with connection.cursor() as cursor:
			cursor.execute('SELECT "userId", "income" FROM "Analytics"')
			rows = [
				{"user_id": user_id, "income": income}
				for user_id, income in cursor.fetchall()
			]

			features, targets, histories = build_training_data(rows)
			model = None
			if len(features) >= 4:
				model = RandomForestRegressor(
					n_estimators=200,
					random_state=42,
					min_samples_leaf=1,
				)
				model.fit(features, targets)

			for user_id, records in histories:
				prediction = predict_income(records, model)
				cursor.execute(
					'UPDATE "Analytics" SET "PredictedIncome" = %s WHERE "userId" = %s',
					(prediction, user_id),
				)

	print(
		f"Updated {len(histories)} analytics row(s) using "
		f"{len(features)} training sample(s)."
	)


if __name__ == "__main__":
	main()
