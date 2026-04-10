from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    vehicleId: int
    sensorIdentifier: str | None = None
    alertType: str
    severity: str
    title: str
    message: str
    status: str
    metadata: dict | None = Field(default=None, alias="eventMetadata")
    recordedAt: datetime
    createdAt: datetime
    resolvedAt: datetime | None = None
