from .routes import router

'''
Models: aquí va el código de la creación de la base de datos de companies
repository: Aquí va el código de las operaciones CRUD de companies
service: Aquí va el código de la lógica de companies (Aquí accederá los endpoint)
routes: Aquí va el código de los endpoints de companies
schemas: Aquí va el código de los esquemas de companies (Pydantic), DTOs
init: Aquí va el código de inicialización del módulo companies

companies es una tabla de la base de datos que almacena información sobre diferentes empresas. Cada empresa tiene atributos como id, name, address, phone, email, creationDate y rnc. El módulo companies proporciona funcionalidades para crear, leer, actualizar y eliminar registros de empresas en la base de datos a través de un conjunto de servicios y rutas API.
'''