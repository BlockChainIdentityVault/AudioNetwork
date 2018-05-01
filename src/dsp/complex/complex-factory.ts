// Copyright (c) 2015-2018 Robert Rypuła - https://audio-network.rypula.pl

import { staticImplements } from 'rr-tsdi';

import { SIMPLE_MATH } from './../../common';

import { GenericException, ISimpleMath } from './../../common';
import { Complex } from './complex';
import { IComplexFactory, IComplexFactoryStatic } from './complex-factory.interface';
import { IComplexDto } from './complex.interface';

@staticImplements<IComplexFactoryStatic>()
export class ComplexFactory implements IComplexFactory {
  public static $inject: string[] = [
    SIMPLE_MATH
  ];

  constructor(
    protected simpleMath: ISimpleMath
  ) {
  }

  public create(real: number = 0, imaginary: number = 0): Complex {
    return new Complex(
      this.simpleMath,
      real,
      imaginary
    );
  }

  public createPolar(unitAngle: number = 0, magnitude: number = 1): Complex {
    const radian: number = 2 * this.simpleMath.getPi() * unitAngle;

    return this.create(
      magnitude * this.simpleMath.cos(radian),
      magnitude * this.simpleMath.sin(radian)
    );
  }

  public createFromDto(complexDto: IComplexDto): Complex {
    return new Complex(
      this.simpleMath,
      complexDto.real,
      complexDto.imaginary
    );
  }

  public createFromRawIQ(rawIQ: number[]): Complex {
    if (rawIQ.length !== 2) {
      throw new GenericException(RAW_IQ_ARRAY_LENGTH_SHOULD_BE_EQUAL_TO_TWO);
    }

    return new Complex(
      this.simpleMath,
      rawIQ[0],
      rawIQ[1]
    );
  }
}

const RAW_IQ_ARRAY_LENGTH_SHOULD_BE_EQUAL_TO_TWO = 'Raw IQ array should be equal to 2';
