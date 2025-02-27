import { T, Var } from 'gt-next';
import { T as GTT, Var as GTVar } from 'gt-react';
export default function Home() {
  const temp = 'Hello World!';

  const test1 = (
    <GTT id='testt2.0'>
      <T id='testt2.0'>
        <div>Hello World!</div>
      </T>
    </GTT>
  );
  const test2 = (
    <GTT id='testt2.1'>
      <T id='testt2.1'>
        <p>Hello World!</p>
      </T>
    </GTT>
  );
  const test3 = <p>{true && <T id='testt2.2'>{'true'}</T>}</p>;
  const test4 = <div>{test2}</div>;
  const test5 = (
    <div>
      {true ? <T id='testt2.3'>{'true'}</T> : <T id='testt2.4'>{'false'}</T>}
    </div>
  );
  const test6 = (
    <div>
      {true ? (
        <GTT id='testt2.2'>
          <T id='testt2.5'>
            <div>true</div>
          </T>
        </GTT>
      ) : (
        <div>{temp}</div>
      )}
    </div>
  );
  return (
    <GTT id='testt2.14'>
      <T id='testt2.35'>
        <div>
          <p>Hello World!</p>
          <p>{'Hello World!'}</p>
          <p>{'Hello,' + ' World!'}</p>
          <div>
            <p>Hello World!</p>
          </div>
          <p>{3 + 3}</p>
          <p>{3 + '3'}</p>
          <p>{3}</p>
          <p>
            <Var>
              <GTVar>{`${3}`}</GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>{`${temp}`}</GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>{`${temp}` + 3}</GTVar>
            </Var>
          </p>
          <p>{`3`}</p>
          <p>{`3` + 3}</p>
          <p>
            <Var>
              <GTVar>{true && <T id='testt2.6'>{'true'}</T>}</GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>{true || <T id='testt2.7'>{'true'}</T>}</GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>
                {true ? (
                  <T id='testt2.8'>{'true'}</T>
                ) : (
                  <T id='testt2.9'>{'false'}</T>
                )}
              </GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>
                {true ? (
                  true ? (
                    <T id='testt2.10'>{'true'}</T>
                  ) : (
                    <T id='testt2.11'>{'false'}</T>
                  )
                ) : (
                  <T id='testt2.12'>{'false'}</T>
                )}
              </GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>
                {true ? (
                  true ? (
                    <T id='testt2.13'>{'true'}</T>
                  ) : (
                    <T id='testt2.14'>{'false'}</T>
                  )
                ) : true ? (
                  <T id='testt2.15'>{'true'}</T>
                ) : (
                  <T id='testt2.16'>{'false'}</T>
                )}
              </GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>
                {true && (
                  <GTT id='testt2.3'>
                    <T id='testt2.17'>
                      <p>true</p>
                    </T>
                  </GTT>
                )}
              </GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>
                {true || (
                  <GTT id='testt2.4'>
                    <T id='testt2.18'>
                      <p>true</p>
                    </T>
                  </GTT>
                )}
              </GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>
                {true ? (
                  <GTT id='testt2.5'>
                    <T id='testt2.19'>
                      <p>true</p>
                    </T>
                  </GTT>
                ) : (
                  <GTT id='testt2.6'>
                    <T id='testt2.20'>
                      <p>false</p>
                    </T>
                  </GTT>
                )}
              </GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>
                {true ? (
                  true ? (
                    <GTT id='testt2.7'>
                      <T id='testt2.21'>
                        <p>true</p>
                      </T>
                    </GTT>
                  ) : (
                    <GTT id='testt2.8'>
                      <T id='testt2.22'>
                        <p>false</p>
                      </T>
                    </GTT>
                  )
                ) : (
                  <GTT id='testt2.9'>
                    <T id='testt2.23'>
                      <p>false</p>
                    </T>
                  </GTT>
                )}
              </GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>
                {true ? (
                  true ? (
                    <GTT id='testt2.10'>
                      <T id='testt2.24'>
                        <p>true</p>
                      </T>
                    </GTT>
                  ) : (
                    <GTT id='testt2.11'>
                      <T id='testt2.25'>
                        <p>false</p>
                      </T>
                    </GTT>
                  )
                ) : true ? (
                  <GTT id='testt2.12'>
                    <T id='testt2.26'>
                      <p>true</p>
                    </T>
                  </GTT>
                ) : (
                  <GTT id='testt2.13'>
                    <T id='testt2.27'>
                      <p>false</p>
                    </T>
                  </GTT>
                )}
              </GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>
                {<T id='testt2.28'>{'hello'}</T> || (
                  <T id='testt2.29'>{'true'}</T>
                )}
              </GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>
                {<T id='testt2.30'>{'hello'}</T> ?? (
                  <T id='testt2.31'>{'true'}</T>
                )}
              </GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>{'hello' && <T id='testt2.32'>{'true'}</T>}</GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>{'hello' && <T id='testt2.33'>{'true'}</T>}</GTVar>
            </Var>
          </p>
          <p>
            <Var>
              <GTVar>{'hello' && <T id='testt2.34'>{'true'}</T>}</GTVar>
            </Var>
          </p>
        </div>
      </T>
    </GTT>
  );
}
