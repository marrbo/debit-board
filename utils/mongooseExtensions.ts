import mongoose from 'mongoose';

// 1. Diz ao TypeScript que a interface existente agora tem esse novo método
declare module 'mongoose' {
  namespace Types {
    interface ObjectId {
      isValidAndNotNull(): boolean;
    }
  }
}

// 2. Cria a implementação real em tempo de execução
mongoose.Types.ObjectId.prototype.isValidAndNotNull = function (this: any): boolean {
  return (
    this !== null &&
    this !== undefined &&
    mongoose.Types.ObjectId.isValid(this as unknown as string)
  );
};

export {};