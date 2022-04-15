const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: '.env' });

const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');
const Usuario = require('../models/Usuario');

const crearToken = (usuario, secreta, expiresIn) => {

  const { id, email, nombre, apellido } = usuario;

  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn })
}

//resolver
const resolvers = {
  Query: {
    obtenerUsuario: async (_, { }, context) => {
      return context.usuario;
    },
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerProducto: async (_, { id }) => {
      try {
        //Existe el producto
        const producto = await Producto.findById(id);

        if (!producto) {
          throw new Error('El producto no existe')
        }
        return producto;
      } catch (error) {

      }

    },
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerClientesVendedor: async (_, { }, context) => {
      try {
        const clientes = await Cliente.find({ vendedor: context.usuario.id.toString() });
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerCliente: async (_, { id }, context) => {
      //Verificar
      const cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error('El cliente no existe')
      }
      if (cliente.vendedor.toString() !== context.usuario.id) {
        throw new Error('No cuentas con las credeciales');
      }

      return cliente;
    },
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedidosVendedor: async (_, { }, context) => {
      try {
        const pedidos = await Pedido.find({ vendedor: context.usuario.id });
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedido: async (_, { id }, context) => {
      //Existe
      const pedido = await Pedido.findById(id);

      if (!pedido) {
        throw new Error('Pedido no encontrado')
      }
      //Solo quien lo creo puede verlo

      if (pedido.vendedor.toString() !== context.usuario.id) {
        throw new Error('No cuenta con las credenciales');
      }

      //retornar
      return pedido;
    },
    obtenerPedidoEstado: async (_, { estado }, context) => {
      const pedidos = await Pedido.find({ vendedor: context.usuario.id, estado });
      return pedidos;
    },
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$cliente",
            total: { $sum: '$total' }
          }
        },
        {
          $lookup: {
            from: 'clientes',
            localField: '_id',
            foreignField: "_id",
            as: "cliente"
          }
        },
        {
          $limit: 10
        },
        {
          $sort: { total: -1 }
        }
      ]);

      return clientes;
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match: { estado: 'COMPLETADO' } },
        {
          $group: {
            _id: '$vendedor',
            total: { $sum: '$total' }
          }
        },
        {
          $lookup: {
            from: 'usuarios',
            localField: '_id',
            foreignField: '_id',
            as: 'vendedor'
          }
        },
        {
          $limit: 3
        },
        {
          $sort: { total: -1 }
        }
      ])
      return vendedores;
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({ $text: { $search: texto } }).limit(10);
      return productos;
    }
  },
  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;

      //Verificar si esta registrado
      const existeUsuario = await Usuario.findOne({ email });

      if (existeUsuario) {
        throw new Error('El usuario ya esta registrado')
      }

      //Hash la contrasena
      const salt = await bcryptjs.genSalt(10);
      input.password = await bcryptjs.hash(password, salt);


      //Guardar en mongo
      try {
        const usuario = new Usuario(input);
        usuario.save();
        return usuario;
      } catch (error) {

      }
    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      const existeUsuario = await Usuario.findOne({ email });

      //Revisar si exite usuario
      if (!existeUsuario) {
        throw new Error('El usuario no esta registrado')
      }

      //Revisar si la contrasena es correcta
      const contrasenaCorrecta = await bcryptjs.compare(password, existeUsuario.password)
      if (!contrasenaCorrecta) {
        throw new Error('Constraseña incorrecta')
      }
      //Crear token
      return {
        token: crearToken(existeUsuario, process.env.Token, '24h')
      }

    },
    nuevoProducto: async (_, { input }) => {
      try {
        const producto = new Producto(input);
        // Guardar en la bd
        const resultado = await producto.save();

        return resultado;

      } catch (error) {
        console.log(error);
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      try {
        //Existe el producto
        let producto = await Producto.findById(id);

        if (!producto) {
          throw new Error('El producto no existe')
        }

        //Guardar
        producto = await Producto.findOneAndUpdate({ _id: id }, input, { new: true });
        return producto;
      } catch (error) {
        console.log(error);
      }
    },
    eliminarProducto: async (_, { id }) => {
      try {
        //Existe el producto
        let producto = await Producto.findById(id);

        if (!producto) {
          throw new Error('El producto no existe')
        }
        await Producto.findOneAndDelete({ _id: id });
        return 'Producto eliminado';
      } catch (error) {

      }
    },
    nuevoCliente: async (_, { input }, context) => {

      const { email } = input;
      const cliente = await Cliente.findOne({ email });

      if (cliente) {
        throw new Error('El cliente ya existe');
      }

      try {
        const nuevoCliente = new Cliente(input);
        nuevoCliente.vendedor = context.usuario.id;
        const resultado = await nuevoCliente.save();

        return resultado;

      } catch (error) {
        throw new Error(error);
      }
    },
    actualizarCliente: async (_, { id, input }, context) => {
      //verificar si existe
      let cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error('El cliente no existe')
      }
      //verificar si es su vendedor 
      if (cliente.vendedor.toString() !== context.usuario.id) {
        throw new Error('No cuentas con las credeciales');
      }
      //Guardar
      cliente = Cliente.findOneAndUpdate({ _id: id }, input, { new: true });
      return cliente;
    },
    eliminarCliente: async (_, { id }, context) => {
      let cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error('El cliente no existe')
      }
      //verificar si es su vendedor 
      if (cliente.vendedor.toString() !== context.usuario.id) {
        throw new Error('No cuentas con las credeciales');
      }
      await Cliente.findOneAndDelete({ _id: id });

      return 'El cliente ha sido eliminado';
    },
    nuevoPedido: async (_, { input }, context) => {

      const { cliente } = input;

      //Verificar si el cliente existe

      let clienteExiste = await Cliente.findById(cliente);
      if (!clienteExiste) {
        throw new Error('El cliente no existe')
      }
      //verificar si el cliente pertenece al vendedor
      if (clienteExiste.vendedor.toString() !== context.usuario.id) {
        throw new Error('No cuentas con las credeciales');
      }

      try {
        //Revisar el stock

        for await (const articulo of input.pedido) {
          const { id } = articulo;
          const producto = await Producto.findById(id);
          if (articulo.cantidad > producto.existencia) {
            throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponible.`)
          } else {
            //restar la cantidad
            producto.existencia = producto.existencia - articulo.cantidad;
            await producto.save();
          }
        }


        //Crear un nuevo pedido
        const nuevoPedido = new Pedido(input);

        //asignarle al vendedor
        nuevoPedido.vendedor = context.usuario.id;

        //guardar
        const resultado = await nuevoPedido.save();

        return resultado;

      } catch (error) {

        console.log(error);
      }
    },
    actualizarPedido: async (_, { id, input }, context) => {
      //Existe pedido
      const existePedido = await Pedido.findById(id);

      if (!existePedido) {
        throw new Error('El pedido no existe');
      }

      //Existe cliente
      const clienteExiste = await Cliente.findById(input.cliente);

      if (!clienteExiste) {
        throw new Error('El cliente no existe');
      }

      //Pedido y cliente pertenerce al vendedor
      if (clienteExiste.vendedor.toString() !== context.usuario.id) {
        throw new Error('No cuentas con las credeciales');
      }

      //Revisar stock
      if (input.pedido) {
        for await (const articulo of input.pedido) {
          const { id } = articulo;
          const producto = await Producto.findById(id);
          if (articulo.cantidad > producto.existencia) {
            throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponible.`)
          } else {
            //restar la cantidad
            producto.existencia = producto.existencia - articulo.cantidad;
            await producto.save();
          }
        }
      }
      //Guardar
      const resultado = await Pedido.findOneAndUpdate({ _id: id }, input, { new: true });

      return resultado;
    },
    eliminarPedido: async (_, { id }, context) => {
      //Existe pedido
      const existePedido = await Pedido.findById(id);

      if (!existePedido) {
        throw new Error('El pedido no existe');
      }

      //Pedido y cliente pertenerce al vendedor
      if (existePedido.vendedor.toString() !== context.usuario.id) {
        throw new Error('No cuentas con las credeciales');
      }

      await Pedido.findOneAndDelete({ _id: id });

      return 'El pedido ha sido eliminado';
    }
  }
}

module.exports = resolvers
