"""
Base Repository Interface and Abstract Generic Repository Implementation.
Provides standard CRUD capabilities isolating ORM details from business services.
Designed for high scalability and maintainability.
"""

from typing import Generic, TypeVar, Type, Optional, List, Any, Dict, Union
from sqlalchemy.orm import Session
from app.core.database import Base

# Type variables for ORM Model, Create Schema, and Update Schema
ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Generic Abstract Base Class for Object-Relational Data Access.
    Encapsulates standard database operations (Create, Read, Update, Delete)
    with strict typing and clear domain boundaries.
    """

    def __init__(self, model: Type[ModelType]) -> None:
        """
        Initialize base repository with target SQLAlchemy model class.

        :param model: The SQLAlchemy model class bound to this repository instance.
        """
        self.model = model

    def get_by_id(self, db: Session, id: Any) -> Optional[ModelType]:
        """
        Retrieve a single model instance by primary key ID.

        :param db: Database session.
        :param id: Primary key identifier.
        :return: Optional instance of ModelType if found, else None.
        """
        return db.query(self.model).filter(self.model.id == id).first()

    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        """
        Retrieve paginated list of records.

        :param db: Database session.
        :param skip: Number of records to skip (offset).
        :param limit: Maximum number of records to return.
        :return: List of model instances.
        """
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: Union[CreateSchemaType, Dict[str, Any]]) -> ModelType:
        """
        Instantiate and persist a new model entity.

        :param db: Database session.
        :param obj_in: Input Pydantic schema or dictionary containing model attributes.
        :return: Newly created and refreshed SQLAlchemy model instance.
        """
        if isinstance(obj_in, dict):
            obj_data = obj_in
        else:
            obj_data = obj_in.model_dump() if hasattr(obj_in, "model_dump") else obj_in.dict()

        db_obj = self.model(**obj_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """
        Update an existing model entity in place.

        :param db: Database session.
        :param db_obj: Existing database model instance to update.
        :param obj_in: Updated schema or dict containing modified fields.
        :return: Updated SQLAlchemy model instance.
        """
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, "model_dump") else obj_in.dict(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: Any) -> Optional[ModelType]:
        """
        Delete a record by primary key ID.

        :param db: Database session.
        :param id: Primary key identifier.
        :return: The deleted model instance if found, else None.
        """
        obj = db.query(self.model).get(id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj
