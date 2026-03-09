from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import tracker.db as db_mod
from tracker.db import init_db, close_db
from api.routes import router

app = FastAPI(title="Productivity Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    if db_mod._conn is None:
        init_db()


@app.on_event("shutdown")
def shutdown():
    close_db()


app.include_router(router)
